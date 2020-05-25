const express = require('express')
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express()
const port = 4000
const apicache = require('apicache')
var cors = require('cors')
let cache = apicache.middleware

var connections = require("./connections").connections
let checkConnections = require("./connections").checkConnections
let execQuery = require("./connections").execQuery
let reconnect = require("./connections").reconnect
let disconnect = require("./connections").disconnect
let testConnection = require("./connections").testConnection
let createConnection = require("./connections").createConnection
let metadataCatalog = require("./connections").metadataCatalog
let metadataObject = require("./connections").getMetadataObject
let execSelect = require("./connections").execSelect

app.use( bodyParser.json()); 
app.use(cors());
app.use(express.json());


app.post('/sql', (req, res) => {
    setTimeout(() => {}, 1000); // to emulate Delay
    try {
        result = execQuery(req.body.database, req.body.query, parseInt(req.body.limit))
        res.send(result)
    } catch (error) {
        res.status(400)
        res.send(error.message)
    }
})

app.post('/sqlScroll', (req, res) => {
    setTimeout(() => {}, 1000); // to emulate Delay
    try {
        result = execSelect(req.body.database, req.body.query, parseInt(req.body.limit), req.body.resultId)
        res.send(result)
    } catch (error) {
        res.status(400)
        res.send(error.message)
    }
})


app.post('/metadataCatalog',  (req, res) => {
    metadata = metadataCatalog(req.body.database)
    res.send(metadata)
})

app.post('/metadataObject',  (req, res) => {
    metadata = metadataObject(req.body.database, req.body.catalog)
    res.send(metadata)
})


app.get('/', (req, res) => {
    res.send('Use POST request. Query example {"query" : "select 1" }')
})

app.get('/connections', (req, res) => {
    res.send(connections)
})

app.get('/connections/reconnect/:connection', (req, res) => {
    connections = reconnect(req.params.connection)
    res.send("success")
})

app.get('/connections/disconnect/:connection', (req, res) => {
    connections = disconnect(req.params.connection)
    res.send("success")
})

app.post('/connections/testConnection', (req, res) => {
    result = testConnection(req.body)
    res.send(result)
})

app.post('/connections/createConnection', (req, res) => {
    connections = createConnection(req.body)
    res.send("success")
})


app.post("/runFile", (req, res)  => {
    try {
        let file = fs.readFileSync(`./store/${req.body.filename}`, "utf8")
        let output = execQuery(req.body.database, file, 0)
        let result = {
            file,
            result : output
        }
        res.send(result)
    } catch (error) {
        res.send(error)
    }
})

app.post("/getFiles", (req, res)  => {
    try {
        res.send(fs.readdirSync("./store", "utf8"))
    } catch (error) {
        res.send(error)
    }
})

app.post("/saveFile", (req, res)  => {
    try {
        let path = "./store/" + req.body.filename
        let dir = fs.writeFileSync(path, req.body.data, "utf8")
        res.sendStatus(200)
    } catch (error) {
        res.send(error)
    }
})

app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))

setInterval(checkConnections, 5000)