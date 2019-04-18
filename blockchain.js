let sha256 = require('sha256');
var dateFormat = require('dateformat');

class Block{

    constructor(index, timeStamp, transactions,previousHash){
        this.index = index;
        this.timeStamp = timeStamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
    }

    calculateHash(){
        return sha256(this.index+this.timeStamp+this.transactions+this.previousHash).toString();
    }

}


class BlockChain{


    constructor(){
        this.Chain = [this.createGenesisBlock()];
        this.pendingTransactions = [];
    }

    createGenesisBlock(){
        let block = new Block('0',dateFormat() ,'genesis','0');
        return block;
    }


     getLastBlock(){
        return this.Chain[this.Chain.length-1];
    }

    addNewBlock(){
        let lastBlock = this.getLastBlock();
        let block = new Block( lastBlock.index+1, dateFormat(),this.pendingTransactions,lastBlock.hash);
        
        this.Chain.push(block);
        this.pendingTransactions = [];
    }

    
    addPendingTransaction(transaction){
        this.pendingTransactions.push(transaction);

        // if(this.pendingTransactions.length >= 10){
        //    this.addNewBlock();
        // }
    }


}


class Transaction{

    constructor(user,chassisNo,km,transaction,comment){
        this.time = dateFormat();
        this.user = user;
        this.chassisNo = chassisNo;
        this.km = km;
        this.transaction = transaction;
        this.comment = comment;
    }

}

module.exports.Block = Block;
module.exports.BlockChain =  BlockChain;
module.exports.Transaction = Transaction;