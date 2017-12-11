const PouchDB = require('pouchdb')
const automerge = require('automerge')
const {save, merge, load, change, init, getHistory} = automerge

class Database {
  constructor (db, actor) {
    this.db = new PouchDB(db)
    this.actor = actor
    this._changes = new Set()
  }
  get id () {
    return this.db.name
  }
  async get (id) {
    let doc = await this.db.get(id)
    return load(doc.am)
  }
  async edit (id, fn, message) {
    let doc = await this.db.get(id)
    let am = load(doc.am)
    if (!message) {
      message = `Edit in ${this.id} at ${Date.now()}`
    }
    let obj = change(am, message, fn)
    doc.am = save(obj)
    await this.db.put(doc)
    return obj
  }
  async merge (id, obj) {
    let doc = await this.db.get(id)
    let am = load(doc.am)
    let ret = merge(am, obj)
    doc.am = save(ret)
    await this.db.put(doc)
    return ret
  }
  async create (_id, fn) {
    let am = init(this.actor)
    let obj = change(am, `Init in ${this.id} at ${Date.now()}`, fn)
    let doc = {_id, am: save(obj)}
    await this.db.put(doc)
    return obj
  }
  async from (_id, obj) {
    let ret = merge(init(this.actor), obj)
    let doc = {_id, am: save(ret)}
    await this.db.put(doc)
    return obj
  }
  // changes (fn) {
  //   this._changes.add(fn)
  // }
  async history (id) {
    let obj = await this.get(id)
    return getHistory(obj)
  }
}

module.exports = (...args) => new Database(...args)
