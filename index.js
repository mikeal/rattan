const PouchDB = require('pouchdb')
const automerge = require('automerge')
const {
  merge,
  change,
  init,
  getHistory,
  inspect,
  getChanges,
  applyChanges
} = automerge

PouchDB.plugin(require('pouchdb-find'))

class Database {
  constructor (db, actor) {
    this.db = new PouchDB(db)
    this.db.createIndex({
      index: {fields: ['_conflicts']}
    })
    this.actor = actor
    this._changes = new Set()
    this._cache = new Map()
  }
  get id () {
    return this.db.name
  }
  async get (id) {
    // TODO: load from snapshot for better performance.
    let [, obj] = await this._get(id)
    return inspect(obj)
  }
  async _get (id) {
    let doc = await this.db.get(id)
    let cached = this._cache.get(id)
    if (cached && cached.rev === doc._rev) return [doc, cached.obj]
    else {
      let obj = applyChanges(init(this.actor), doc.changes)
      this._cache.set(id, {obj, rev: doc._rev})
      return [doc, obj]
    }
  }
  async getDocument (...args) {
    return this.db.get(...args)
  }
  async edit (id, fn, message) {
    if (!message) {
      message = `Edit in ${this.id} at ${Date.now()}`
    }

    let [doc, obj] = await this._get(id)
    obj = change(obj, message, fn)
    doc.changes = getChanges(init(this.actor), obj)
    doc.snapshot = inspect(obj)

    await this.db.put(doc)
    return doc.snapshot
  }
  async merge (id, newdoc) {
    // if (newdoc._id) {
    //   newdoc = applyChanges(init(this.actor), newdoc.changes)
    // }
    newdoc = applyChanges(init(this.actor), newdoc.changes)

    let [doc, obj] = await this._get(id)
    obj = merge(obj, newdoc)
    doc.changes = getChanges(init(this.actor), obj)
    doc.snapshot = inspect(obj)

    await this.db.put(doc)
    return doc.snapshot
  }
  async create (_id, fn) {
    let message = `Init in ${this.id} at ${Date.now()}`
    let obj = change(init(this.actor), message, fn)
    let doc = {
      _id,
      changes: getChanges(init(this.actor), obj),
      snapshot: inspect(obj)
    }
    await this.db.put(doc)
    return doc.snapshot
  }
  async from (_id, original) {
    // if (original._id) {
    //   original = applyChanges(init(this.actor), original.changes)
    // }
    original = applyChanges(init(this.actor), original.changes)
    let ret = merge(init(this.actor), original)
    let doc = {
      _id,
      changes: getChanges(init(this.actor), ret),
      snapshot: inspect(ret)
    }
    await this.db.put(doc)
    return doc.snapshot
  }
  async history (id) {
    let [, obj] = await this._get(id)
    return getHistory(obj)
  }
  // async conflicts () {
  //   // TODO: replace tmp query with a stored query.
  //   let ret = await this.db.query(function (doc, emit) {
  //     if (doc._conflicts) {
  //       emit(null, doc._conflicts)
  //     }
  //   })
  //   return ret.rows.map(o => {
  //     return {id: o.id, conflicts: o.value}
  //   })
  // }
  // async _resolveConflicts () {
  //   let conflicts = await this.conflicts()
  //   return Promise.all(conflicts.map(async conflict => {
  //     let docs = await Promise.all(conflict.conflicts.map(async rev => {
  //       return this.db.get(conflict.id, {rev})
  //     }))
  //     let current = await this.db.get(conflict.id)
  //     let obj = load(current.am)
  //     docs.forEach(doc => {
  //       merge(obj, load(doc.am))
  //     })
  //     current.am = save(obj)
  //     current.snapshot = inspect(obj)
  //     return this.db.put(current)
  //   }))
  // }
  async push (remote) {
    let info = await this.db.replicate.to(remote)
    // info.conflicts = await this._resolveConflicts()
    return info
  }
  async pull (remote) {
    let info = this.db.replicate.from(remote)
    // info.conflicts = await this._resolveConflicts()
    return info
  }
  // TODO: sync() API
}

module.exports = (...args) => new Database(...args)
