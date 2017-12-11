let rattan = require('../')
let {test} = require('tap')

require('pouchdb').plugin(require('pouchdb-adapter-memory'))

const random = () => Math.random(12).toString()

const getDatabase = () => {
  return rattan({name: random(), adapter: 'memory'})
}

test('basics: create', async t => {
  t.plan(2)
  let db = getDatabase()
  let doc = await db.create('test1', doc => { doc.ok = true })
  t.same(doc.ok, true)
  let doc2 = await db.get('test1')
  t.same(doc, doc2)
})

test('basics: edit', async t => {
  t.plan(2)
  let db = getDatabase()
  let doc = await db.create('test1', doc => { doc.ok = true })
  doc = await db.edit('test1', doc => { doc.ok = 'pass' })
  t.same(doc.ok, 'pass')
  let doc2 = await db.get('test1')
  t.same(doc, doc2)
})

test('basics: merge', async t => {
  t.plan(7)
  let db = getDatabase()
  let doc = await db.create('test1', doc => { doc.ok = true })
  let doc2 = await db.create('test2', doc => { doc.second = true })
  t.same(doc.ok, true)
  t.ok(!doc2.ok)
  t.same(doc2.second, true)
  t.ok(!doc.second)
  let merged = await db.merge('test1', doc2)
  t.same(merged.ok, true)
  t.same(merged.second, true)
  t.same(merged, await db.get('test1'))
})

test('basics: from', async t => {
  t.plan(1)
  let db = getDatabase()
  let doc = await db.create('test1', doc => { doc.ok = true })
  await db.from('test2', doc)
  let history1 = await db.history('test1')
  let history2 = await db.history('test2')
  let _map = hist => hist.change
  t.same(history1.map(_map), history2.map(_map))
})

test('basics: edit w/ custom message', async t => {
  t.plan(3)
  let db = getDatabase()
  let doc = await db.create('test1', doc => { doc.ok = true })
  doc = await db.edit('test1', doc => { doc.ok = 'pass' }, 'test-message')
  t.same(doc.ok, 'pass')
  let doc2 = await db.get('test1')
  t.same(doc, doc2)
  let history = await db.history('test1')
  t.same(history[1].change.message, 'test-message')
})
