const PouchDB = require('pouchdb')
const automerge = require('automerge')
const {save, merge, load, change, init, getHistory, inspect} = automerge

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
    let doc = await this._get(id)
    return inspect(doc)
  }
  async _get (id) {
    let doc = await this.db.get(id)
    return load(doc.am)
  }
  async getDocument (id) {
    return this.db.get(id)
  }
  async edit (id, fn, message) {
    let doc = await this.db.get(id)
    let am = load(doc.am)
    if (!message) {
      message = `Edit in ${this.id} at ${Date.now()}`
    }
    let obj = change(am, message, fn)
    let _am = save(obj)
    /* Note that there is not check to see if this
       is an actual change like there is in merge().
       That's because there's *always* a change with a message.
    */
    doc.am = _am
    doc.snapshot = inspect(obj)
    await this.db.put(doc)
    return doc.snapshot
  }
  async merge (id, newdoc) {
    let doc = await this.db.get(id)
    let am = load(doc.am)
    let ret = merge(am, load(newdoc.am))
    let _am = save(ret)
    if (_am !== doc.am) {
      doc.am = _am
      doc.snapshot = inspect(ret)
      await this.db.put(doc)
    }
    return doc.snapshot
  }
  async create (_id, fn) {
    let am = init(this.actor)
    let obj = change(am, `Init in ${this.id} at ${Date.now()}`, fn)
    let doc = {_id, am: save(obj), snapshot: inspect(obj)}
    await this.db.put(doc)
    return doc.snapshot
  }
  async from (_id, original) {
    let ret = merge(init(this.actor), load(original.am))
    let doc = {_id, am: save(ret), snapshot: inspect(ret)}
    await this.db.put(doc)
    return doc.snapshot
  }
  async history (id) {
    let obj = await this._get(id)
    return getHistory(obj)
  }
  async push (remote) {
    return this.db.replicate.to(remote)
    // TODO: query and resolve any conflicted documents.
  }
  async pull (remote) {
    return this.db.replicate.from(remote)
    // TODO: query and resolve any conflicted documents.
  }
  // TODO: sync() API
}

module.exports = (...args) => new Database(...args)
