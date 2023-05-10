"use strict";

process.title = "Dogecoin Bruteforce";

//Creaded by: Corvus Codex
//Github: https://github.com/CorvusCodex/
//Licence : MIT License

//Support my work:
//BTC: bc1q7wth254atug2p4v9j3krk9kauc0ehys2u8tgg3
//ETH & BNB: 0x68B6D33Ad1A3e0aFaDA60d6ADf8594601BE492F0
//Buy me a coffee: https://www.buymeacoffee.com/CorvusCodex

const CoinKey = require('coinkey');
const ci = require('coininfo');
const fs = require('fs');
const crypto = require('crypto');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const blessed = require('blessed');

let addresses;
addresses = new Set();

const data = fs.readFileSync('./dogs.txt');
data.toString().split("\n").forEach(address => addresses.add(address));

let counts = {};
let recentKeys = [];
let startTime = Date.now();
let lastRecentKeysUpdate = Date.now();

function generate() {
    counts[cluster.worker.id] = (counts[cluster.worker.id] || 0) + 1;
    process.send({counts: counts});
    
    let privateKeyHex = crypto.randomBytes(32).toString('hex');
    
    let ck = new CoinKey(Buffer.from(privateKeyHex, 'hex'), ci('DOGE').versions);
    
    ck.compressed = false;

    recentKeys.push({address: ck.publicAddress, privateKey: ck.privateWif});
    if (recentKeys.length > 10) {
        recentKeys.shift();
    }
    if (Date.now() - lastRecentKeysUpdate > 60000) {
        process.send({recentKeys: recentKeys});
        lastRecentKeysUpdate = Date.now();
    }

    if(addresses.has(ck.publicAddress)){
        console.log("");
        process.stdout.write('\x07');
        console.log("\x1b[32m%s\x1b[0m", ">> Success: " + ck.publicAddress);
        var successString = "Wallet: " + ck.publicAddress + "\n\nSeed: " + ck.privateWif;
            
        // save the wallet and its private key (seed) to a Success.txt file in the same folder 
        fs.writeFileSync('./match.txt', successString, (err) => {
            if (err) throw err; 
        })
        process.exit();
    }
}

if (cluster.isMaster) {
    let screen = blessed.screen({
        smartCSR: true
    });

    let boxes = [];

    for (let i = 0; i < numCPUs; i++) {
        let box = blessed.box({
            top: `${i * 100/numCPUs}%`,
            left: 0,
            width: '50%',
            height: `${100/numCPUs}%`,
            content: `Worker ${i+1} Keys generated: 0 Speed: 0 keys/min`,
            border: {
                type: 'line'
            },
            style: {
                fg: 'green',
                border: {
                    fg: 'green'
                }
            }
        });
        screen.append(box);
        boxes.push(box);
    
    }

    let recentKeysBox = blessed.box({
        top: 0,
        left: '50%',
        width: '50%',
        height: '100%',
        content: `Recent 10 keys sample (updated every minute):\n`,
        border: {
            type: 'line'
        },
        style: {
            fg: 'green',
            border: {
                fg: 'green'
            }
        }
    });
    screen.append(recentKeysBox);
    

    screen.render();

    cluster.on('message', (worker, message) => {
        if (message.counts) {
            for (let workerId in message.counts) {
                let elapsedTimeInMinutes = (Date.now() - startTime) / 60000;
                let speedPerMinute = message.counts[workerId] / elapsedTimeInMinutes;
                boxes[workerId-1].setContent(`Worker ${workerId} Keys generated: ${message.counts[workerId]} Speed: ${speedPerMinute.toFixed(2)} keys/min`);
            }
            screen.render();
        }
        if (message.recentKeys) {
            let content = `Recent keys:\n`;
            message.recentKeys.forEach(key => {
                content += `Address: ${key.address} Private key:${key.privateKey}\n`;
            });
            recentKeysBox.setContent(content);
            screen.render();
        }
    });

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
} else {
    setInterval(generate, 0);
}
