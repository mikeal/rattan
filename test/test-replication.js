const rattan = require('../')
const tap = require('tap')
const bent = require('bent')
const path = require('path')
const mkdirp = require('mkdirp')
const http = require('http')
const tmpdir = require('os').tmpdir()
const {promisify} = require('util')

const PouchDB = require('pouchdb')

const random = () => Math.random(12).toString()

const getDatabase = (name) => {
  const prefix = path.join(tmpdir, random())
  mkdirp.sync(prefix)
  return rattan({name, prefix})
}

const start = async () => {
  const prefix = path.join(tmpdir, random())
  mkdirp.sync(prefix)
  const TempPouchDB = PouchDB.defaults({prefix})
  const express = require('express')
  const app = express()
  const opts = {
    logPath: path.join(prefix, 'log.txt'),
    configPath: path.join(prefix, 'config.json')
  }

  app.use('/db', require('express-pouchdb')(TempPouchDB, opts))

  let server = http.createServer(app)
  await promisify(cb => server.listen(3000, cb))()
  return promisify(cb => server.close(cb))
}

const test = (str, fn) => {
  tap.test(str, async t => {
    let stop = await start()
    await fn(t)
    await stop()
  })
}

test('replication: push', async t => {
  t.plan(2)
  let getJSON = bent('json', 'http://localhost:3000/db')
  let db = getDatabase('db1')
  await db.create('test1', doc => { doc.ok = true })
  await db.push('http://localhost:3000/db/db1')
  let doc = await getJSON('/db1/test1')
  t.same(doc._id, 'test1')
  t.same(doc.snapshot.ok, true)
})

test('replication: pull', async t => {
  t.plan(1)
  let db = getDatabase('db1')
  await db.create('test1', doc => { doc.ok = true })
  await db.push('http://localhost:3000/db/db2')
  let db2 = getDatabase('db2')
  await db2.pull('http://localhost:3000/db/db2')
  let doc = await db2.get('test1')
  t.same(doc.ok, true)
})
