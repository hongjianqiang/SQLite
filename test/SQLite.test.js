const SQLite = require('../SQLite');

const expect = require('chai').expect;

let db = new SQLite(':memory:');

describe('创建表测试', function() {

    it('异步创建表，返回一个对象，且属性 length 为 0', function() {
        return db.create('table1', {
            from: 'TEXT',
            to: 'TEXT',
            amount: 'REAL',
            contract: 'TEXT',
            memo: 'TEXT',
            date: 'NUMERIC',
            nonce: 'INTEGER',
            default: 'INTEGER DEFAULT 123'
        }).then(rows=>{
            expect(rows).to.be.an('object');
            expect(rows.length).to.be.equal(0);
        });
    });

    it('异步创建表，包含 rowid 列时，应该返回一个错误', function() {
        return db.create('table2', {
            rowid: 'INTEGER',
            memo: 'TEXT'
        }).then(rows=>{
            expect(true).to.be.equal(false);
        }).catch(err=>{
            expect(err).to.be.equal('rowid 为 SQLite 保留的隐藏列名，不能用于自定义列名');
        });
    })
    
});

describe('插入数据测试', function() {

    for( let i=0; i<5; i++ ){
        it('异步插入第'+(i+1)+'条数据，返回一个对象，且属性 length 为 0', function() {
            return db.emplace('table1', {
                from: 'eosjianqiang',
                to: 'yongyongyong',
                amount: 1.2345,
                memo: '',
                nonce: (i+1)
            }).then(rows=>{
                expect(rows).to.be.an('object');
                expect(rows.length).to.be.equal(0);
            });
        });
    }

});

describe('查询数据测试', function() {

    it('查询第2条数据，返回一个对象，且属性 length 为 1', function() {
        return db.find('table1', 2).then(rows=>{
            expect(rows).to.be.an('object');
            expect(rows.length).to.be.equal(1);
        });
    });

    it('查询一个存在的唯一的数据，返回一个对象，且属性 length 为 1', function() {
        return db.find('table1', {
            nonce: 4
        }).then(rows=>{
            expect(rows).to.be.an('object');
            expect(rows.length).to.be.equal(1);
            expect(rows[0].nonce).to.be.equal(4);
        });
    });

    it('查询一个存在的不唯一的数据，返回一个对象，且属性 length 为 5', function() {
        return db.find('table1', {
            from: 'eosjianqiang',
            to: 'yongyongyong'
        }).then(rows=>{
            expect(rows).to.be.an('object');
            expect(rows.length).to.be.equal(5);
        });
    });

    it('查询一个不存在的数据，返回一个对象，且属性 length 为 0', function() {
        return db.find('table1', {
            from: 'xixixixixixi'
        }).then(rows=>{
            expect(rows).to.be.an('object');
            expect(rows.length).to.be.equal(0);
        });
    });

});

describe('删除数据测试', function() {

    it('删除第1条数据，返回一个对象，且属性 length 为 0，剩下4条数据', function() {
        return db.remove('table1', {
            nonce: 1
        }).then(rows=>{
            expect(rows).to.be.an('object');
            expect(rows.length).to.be.equal(0);
            return db.find('table1');
        }).then(rows=>{
            expect(rows.length).to.be.equal(4);
        });
    });

    it('删除查询到的第1条数据，剩下3条数据', function() {
        return db.find('table1', {
            from: 'eosjianqiang'
        }).then(rows=>{
            rows.remove(0);
            return db.find('table1');
        }).then(rows=>{
            expect(rows.length).to.be.equal(3);
        });
    });

});

describe('修改数据测试', function() {

    it('修改符合条件的所有数据', function() {
        return db.update('table1', {
            from: 'eosjianqiang'
        }, {
            from: 'xixixixixixi'
        }).then(rows=>{
            expect(rows.length).to.be.equal(0);
            return db.find('table1');
        }).then(rows=>{
            for( let i=0; i<rows.length; i++ ){
                expect(rows[i].from).to.be.equal('xixixixixixi');
            }
        });
    });

    it('修改查询到的某条数据', function() {
        return db.find('table1', {
            to: 'yongyongyong'
        }).then(rows=>{
            rows.update(0, {
                to: 'mytokenbank1'
            });
            return db.find('table1', {
                to: 'mytokenbank1'
            });
        }).then(rows=>{
            expect(rows.length).to.be.equal(1);
        });
    });

});
