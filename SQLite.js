/**
 * File: SQLite.js
 * Author: Hong Jian Qiang
 * Email: 569250030@qq.com
 * Datetime: 2019-02-16
 */

const sqlite3 = require('sqlite3').verbose();

const utils = {
    serializeCols(data) {
        let keys = Object.keys(data);
        let values = Object.values(data);

        let serialized = keys.map((item, index) => { 
            return '"'+item+'" '+values[index]; 
        }).join(', '); 

        return serialized;
    },
    serializeKeys(data) {
        let keys = Object.keys(data).map(k=>('"'+k+'"')).join(',');

        return keys;
    },
    serializeValues(data) {
        let values = Object.values(data).map(v=>{
            let type = Object.prototype.toString.call(v);

            if( '[object Number]'===type && !isNaN(v) && Infinity!==v ) {
                return v;
            } else {
                return '"'+v+'"';
            }
        }).join(',');

        return values;
    },
    serializeSet(data) {
        let keys = Object.keys(data);
        let values = Object.values(data).map(v=>{
            let type = Object.prototype.toString.call(v);

            if( '[object Number]'===type && !isNaN(v) && Infinity!==v ) {
                return v;
            } else {
                return '"'+v+'"';
            }
        });

        let serialized = keys.map((item, index) => { 
            return '"'+item+'" = '+values[index]; 
        }).join(', '); 

        return serialized;        
    },
    serialzieWhere(data, separator = ' AND ') {
        let keys = Object.keys(data);
        let values = Object.values(data);

        let serialized = keys.map((item, index) => { 
            let value = values[index];
            let valueType = Object.prototype.toString.call(value);

            if( '[object String]'===valueType ) {

                return '"'+item+'" == "'+value+'"';

            } else if( '[object Number]'===valueType && !isNaN(value) && Infinity!==value ) {
                
                return '"'+item+'" == '+value;
            
            } else if( null===value ) {

                return '"'+item+'" IS NULL';

            } else {
                
                return '"'+item+'" == "'+value+'"';
            
            }
        }).join(separator);

        return serialized;
    }
};

class SQLite {
    constructor(path) {
        this._db    = null;
        this.path   = path;
        this.isExec = false;
        this.queue  = [];
    }

    /**
     * 创建一个表
     */
    create(table, data) {
        return new Promise((resolve, reject)=>{
            let dataType = Object.prototype.toString.call(data);

            if( '[object Object]'!==dataType ) {

                reject('传入的 data 参数必须为 [object Object] 类型');

            } else if(data.hasOwnProperty('rowid')) {

                reject('rowid 为 SQLite 保留的隐藏列名，不能用于自定义列名');

            } else {

                let serialized = utils.serializeCols(data);

                const sql = `CREATE TABLE IF NOT EXISTS "${table}" (${serialized})`;

                this.queue.push({
                    table,
                    method: 'all',
                    params: [sql, resolve, reject]
                });

                this.trigger();

            }
        });
    }

    /**
     * 增
     */
    emplace(table, data) {
        return new Promise((resolve, reject)=>{
            let dataType = Object.prototype.toString.call(data);

            if( '[object Object]'!==dataType ) {

                reject('传入的 data 参数必须为 [object Object] 类型');

            } else {

                let keys = utils.serializeKeys(data);

                let values = utils.serializeValues(data);

                const sql = `INSERT INTO "${table}" (${keys}) VALUES (${values})`; 

                this.queue.push({
                    table,
                    method: 'all',
                    params: [sql, resolve, reject]
                });

                this.trigger();
            }
        });
    }

    /**
     * 删
     */
    remove(table, data) {
        return new Promise((resolve, reject)=>{
            let dataType = Object.prototype.toString.call(data);

            if( '[object Object]'!==dataType ) {

                reject('传入的 data 参数必须为 [object Object] 类型');

            } else {
                let serialized = utils.serialzieWhere(data);

                const sql = `DELETE FROM "${table}" WHERE ${serialized}`;

                this.queue.push({
                    method: 'all',
                    params: [sql, resolve, reject]
                });

                this.trigger();
            }
        });
    }

    /**
     * 改
     */
    update(table, condition, data) {
        return new Promise((resolve, reject)=>{
            let dataType = Object.prototype.toString.call(data);
            let conditionType = Object.prototype.toString.call(condition);

            if( '[object Object]'!==dataType ) {

                reject('传入的 data 参数必须为 [object Object] 类型');

            } else if ( '[object Object]'!==conditionType ) {

                reject('传入的 condition 参数必须为 [object Object] 类型');

            } else {
                let serializedData = utils.serializeSet(data);
                let serializedCondition = utils.serialzieWhere(condition);

                const sql = `UPDATE "${table}" SET ${serializedData} WHERE ${serializedCondition}`;

                this.queue.push({
                    method: 'all',
                    params: [sql, resolve, reject]
                });

                this.trigger();
            }
        });
    }

    /**
     * 查
     */
    find(table, data) {
        return new Promise((resolve, reject)=>{
            let sql = '';
            let dataType = Object.prototype.toString.call(data);

            if( '[object Number]'===dataType && !isNaN(data) && Infinity!==data ) {

                sql = `SELECT rowid,* FROM "${table}" WHERE rowid == ${data}`;

            } else if( '[object Object]'===dataType ) {

                let serialized = utils.serialzieWhere(data);

                sql = `SELECT rowid,* FROM "${table}" WHERE ${serialized}`;
            } else {

                sql = `SELECT rowid,* FROM "${table}"`;

            }

            this.queue.push({
                table,
                method: 'all',
                params: [sql, resolve, reject]
            });

            this.trigger();
        });
    }

    trigger() {
        if( !this.isExec ) {
            if( ':memory:'!==this.path || !this._db ) {
                this._db = new sqlite3.Database(this.path);
            }
            this._next();
        }
    }

    _next() {
        this.isExec = true;

        let oper = this.queue.shift();

        if( oper ) {
            const self = this;
            let table  = oper.table;
            let method = oper.method;
            let params = oper.params.slice(0, oper.params.length-2);
            let callback = (error, ...data)=>{
                if( error ) {
                    oper.params[oper.params.length-1](error);  // reject
                } else {
                    let iterable = {
                        data: data.flat(Infinity),
                        [Symbol.iterator]() {
                            const _self = this;
                            let index = 0;
                            let obj = {
                                prev() {
                                    index--;
                                    if( index>=0 ) {
                                        return {
                                            value: _self.data[index],
                                            done: false,
                                            remove: ()=>self.remove(table, _self.data[index])
                                        };
                                    } else {
                                        return {
                                            value: undefined,
                                            done: true,
                                            remove: ()=>{}
                                        };
                                    }
                                },
                                next() {
                                    if( index<_self.data.length ) {
                                        index++;
                                        return {
                                            value: _self.data[index-1],
                                            done: false,
                                            remove: ()=>self.remove(table, _self.data[index-1])
                                        };
                                    } else {
                                        return {
                                            value: undefined,
                                            done: true,
                                            remove: ()=>{}
                                        }
                                    }
                                },
                                reset() {
                                    index = 0;
                                    if( index<_self.data.length ) {
                                        return {
                                            value: _self.data[index],
                                            done: false
                                        };
                                    } else {
                                        return {
                                            value: undefined,
                                            done: true
                                        };
                                    }
                                },
                                allData() {
                                    return _self.data;
                                },
                                update(i, data) {
                                    return self.update(table, _self.data[i], data);
                                },
                                remove(i) {
                                    return self.remove(table, _self.data[i]);
                                },
                                length: _self.data.length                             
                            };

                            for( let i=0; i<_self.data.length; i++ ) {
                                obj[i] = null;
                                Object.defineProperty(obj, i, {
                                    get() {
                                        return _self.data[i];
                                    }
                                });
                            }

                            return obj;
                        }
                    };

                    let iterator= iterable[Symbol.iterator]();  // 创建一个迭代器

                    oper.params[oper.params.length-2](iterator);  // resolve，返回一个迭代器
                }

                this._next();
            }

            params.push(callback);

            this._db[oper.method](...params);
        } else {
            if( ':memory:'!==this.path ) {
                this._db.close();
            }
            this.isExec = false;
            return;
        }
    }
}

module.exports = SQLite;
