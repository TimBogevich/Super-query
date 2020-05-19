var JDBC = require('jdbc');
var java = require('java');
const express = require('express')
const bodyParser = require('body-parser');
const fs = require('fs');
java.options.push("-Xrs")
java.classpath.pushDir("./drivers")


var connections = []
let config = JSON.parse(fs.readFileSync('connections.cfg'));

config.forEach(element => {
    conn = connect(element.connectionString, element.user, element.password)
    conn.name = element.name
    connections.push(conn) 
});

function connect(connectionString,user,password) {
    let connection = java.callStaticMethodSync("java.sql.DriverManager", "getConnection",connectionString, user, password)
    conn = {
        connectionString : connectionString,
        connection : connection,
        status : "OK",
        lastConnectDate : new Date(),
        disconnectedManually : false,
    }
    return conn
}

function getConnection(connName) {
    return  connections.filter(item => item.name == connName)[0]
    
}

function reconnect(connName) {
    let conn = config.filter(item => item.name == connName ) [0]
    connection = connect(conn.connectionString, conn.user, conn.password)
    connections = connections.map(item => {
        if (item.name == connName) {
            item = connection
            item.name = connName
        }
        return item
    })
    return connections
}

function disconnect(connName) {
    connections = connections.map(item => {
        if (item.name == connName) {
            item.connection = null
            item.status = "DISCONNECTED"
            item.disconnectedManually = true
        }
        return item
    })
    return connections
}

function checkConnections() {
    for (key in connections) {
        let disconnectedManually = connections[key].disconnectedManually
        if (disconnectedManually) {
            continue
        }
        let conn = connections[key].connection
        let connName = connections[key].name
        if(!conn.isValidSync(5)) {
            console.log(`Found wrong connection ${key}`)
            try {
                let config = JSON.parse(fs.readFileSync('connections.cfg'));
                let connElement = config.filter(item => item.name == connName)[0]
                connections[key].connection = java.callStaticMethodSync("java.sql.DriverManager", "getConnection",connElement.connectionString, connElement.user, connElement.password)
                console.log(`Connection ${key} was restored`)
            } catch (error) {
                console.log(`Couldn't restore connection ${key}. ${error}`)
            }

        }
    }  
}


function rsToJson(resultSet) {
    var js = []
    var total_columns = resultSet.getMetaDataSync().getColumnCountSync();
    
    while (resultSet.nextSync()) {
        var row = {}
        for (i = 1; i <= total_columns; i++) {
            key = resultSet.getMetaDataSync().getColumnLabelSync(i)
            value = resultSet.getStringSync(i)
            row[key] = value
        }
        js.push(row)
    }
    return js
}


function execQuery(connName, query, limit) {
    queries = query.split(";")
    connection = getConnection(connName).connection
    return queries.map(item => {
        selectStmt = connection.createStatementSync();
        if(item.trim().substring(0,6).toLowerCase() == "select") {
            if(limit > 0) {
                selectStmt.setMaxRowsSync(limit)
                selectStmt.setFetchSizeSync(limit)
            }
            resultSet = selectStmt.executeQuerySync(item);
            return rsToJson(resultSet)
        }
        else if(item.trim() == "") {
            return
        }
        else{
            try {
                resultSet = selectStmt.executeSync(item);
                return [{"Query":item,"Result": "SUCCESS"}]
            }
            catch(error) {
                return [{"Query":item,"Result": error.cause.getMessageSync()}]
            }
        }
    })
}

function getMetadata(connName) {
    let connection = getConnection(connName).connection
    dbMeta = connection.getMetaDataSync()

    catalog = null
    schemaPattern = null,
    tableNamePattern = null;
    columnNamePattern = null;
    types = null
    rsTables = dbMeta.getTablesSync(catalog, schemaPattern, tableNamePattern, types);

    var metadata = []
    while (rsTables.nextSync()) {
        objectName = rsTables.getStringSync(3);
        objectSchema = rsTables.getStringSync(1),
        rsColumns = dbMeta.getColumnsSync(catalog, schemaPattern, objectName, columnNamePattern);
        columns = []
        while (rsColumns.nextSync()) {
            column = {}
            column.columnName = rsColumns.getStringSync("COLUMN_NAME");
            column.columnType = rsColumns.getStringSync("TYPE_NAME");
            column.columnSize = rsColumns.getIntSync("COLUMN_SIZE");
            columns.push(column)
        }
        table = {
            objectType : rsTables.getStringSync(4),
            objectName : objectName,
            columns : columns
        }
        var schema = metadata.filter(item => item.objectName === objectSchema)[0]
        if (schema) {
            schema.children.push(table)
        }
        else {
            metadata.push({
                objectName: objectSchema,
                objectType : "Database",
                children : [table]
            })
        }

    }
    return metadata
}

module.exports = {
    connections,
    checkConnections,
    execQuery,
    getMetadata,
    reconnect,
    disconnect,
}