var JDBC = require('jdbc');
var java = require('java');
const express = require('express')
const bodyParser = require('body-parser');
const fs = require('fs');
java.options.push("-Xrs")
java.classpath.pushDir("./drivers")
uuidv4 = require("uuid").v4

var connections = []
var config = JSON.parse(fs.readFileSync('connections.cfg'));
var results = {}

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
            console.log(`Found wrong connection ${connections[key].name}`)
            try {
                let config = JSON.parse(fs.readFileSync('connections.cfg'));
                let connElement = config.filter(item => item.name == connName)[0]
                connections[key].connection = java.callStaticMethodSync("java.sql.DriverManager", "getConnection",connElement.connectionString, connElement.user, connElement.password)
                console.log(`Connection ${connections[key].name} was restored`)
            } catch (error) {
                console.log(`Couldn't restore connection ${connections[key].name}. ${error}`)
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

function testConnection(connConfig) {
    connection = connect(connConfig.connectionString, connConfig.user, connConfig.password)
    return connection
}

function createConnection(connConfig) {
    connection = connect(connConfig.connectionString, connConfig.user, connConfig.password)
    connection.name = connConfig.name
    config.push(connConfig)
    fs.writeFileSync("./connections.cfg", JSON.stringify(config, null, 4) )
    connections.push(connection)
    return connections
}

function execQuery(connName, query, limit, batchSize) {
  queries = query.split(";").filter(item => item.trim() != "")
  connection = getConnection(connName).connection
  return queries.map(query => {
    try {
      stmt = connection.createStatementSync();
      stmt.setMaxRowsSync(limit)
      hasResultSet = stmt.executeSync(query)
      if(hasResultSet) {
        resultSet = stmt.getResultSetSync()
        return ProcessResultSet(resultSet,connName, batchSize, query, null)
      }
      else {
        rowsAffected = stmt.getUpdateCountSync()  
        return {query, "result": "SUCCESS", queryType : "command"}
      }
    } catch (error) {
      return {query,"result": error.cause.getMessageSync()}
    }
  })
}


function setDefaultCatalog(connName, catalog) {
    let connection = getConnection(connName).connection
    connection.setCatalogSync(catalog)
}


function metadataCatalog(connName) {
    let connection = getConnection(connName).connection
    dbMeta = connection.getMetaDataSync()
    catalogs = dbMeta.getCatalogsSync();
    var metadata = []
    while (catalogs.nextSync()){
        catalogName = catalogs.getStringSync("TABLE_CAT")
        metadata.push({
            objectName: catalogName,
            objectType : "Database",
            menuType : "Catalog",
            children : [],
            uid : uuidv4(),
        })
    }
    return metadata
}


function getMetadataObject(connName, catalog) {
    let connection = getConnection(connName).connection
    dbMeta = connection.getMetaDataSync()

    schemaPattern = null,
    tableNamePattern = null;
    columnNamePattern = null;
    types = null
    rsTables = dbMeta.getTablesSync(catalog, schemaPattern, tableNamePattern, types);
    rsProcedures = dbMeta.getProceduresSync(catalog, schemaPattern, null); 
    rsProceduresColumns = dbMeta.getProcedureColumnsSync(catalog,null, null,null)

    var metadata = []
    while (rsProcedures.nextSync()) {
      objectName = rsProcedures.getStringSync("PROCEDURE_NAME")
      objectSchema = rsProcedures.getStringSync("PROCEDURE_SCHEM")
      objectType = "PROCEDURE"
      metadataType = metadata.filter(item => item.objectType == objectType)
      let children = {objectType,objectName, catalog, menuType:"procedure", uid:uuidv4()}
      if (metadataType.length == 0) {
          metadata.push({
              objectType : objectType,
              objectName: objectType,
              uid : uuidv4(),
              children : [children]
          })
      }
      else {
        metadataType[0].children.push(children)
    }
    }
    while (rsTables.nextSync()) {
        objectName = rsTables.getStringSync(3)
        objectSchema = rsTables.getStringSync(1)
        objectType = rsTables.getStringSync(4)
        rsColumns = dbMeta.getColumnsSync(catalog, schemaPattern, objectName, columnNamePattern);
        columns = []
        while (rsColumns.nextSync()) {
            column = {}
            column.columnName = rsColumns.getStringSync("COLUMN_NAME");
            column.columnType = rsColumns.getStringSync("TYPE_NAME");
            column.columnSize = rsColumns.getIntSync("COLUMN_SIZE");
            columns.push(column)
        }
        metadataType = metadata.filter(item => item.objectType == objectType)
        let children = {objectType,objectName,columns, catalog, menuType:"selectable", uid:uuidv4()}
        if (metadataType.length == 0) {
            metadata.push({
                objectType : objectType,
                objectName: objectType,
                uid : uuidv4(),
                children : [children]
            })
        }
        else {
            metadataType[0].children.push(children)
        }
    }
    return metadata
}

function ProcessResultSet(resultSet, connName, batchSize, query, resultId) {
  if (!results[resultId]) {
      uid = uuidv4()
      results[uid] = {
        query,
        connName,
        resultSet,
        dateOfCreation : new Date
      }
  }
  else {
      resultSet = results[resultId].resultSet
      connName = results[resultId].connName
      query = results[resultId].query
  }
  var total_columns = resultSet.getMetaDataSync().getColumnCountSync();
  js = []
  var endCursor = false
  for (let rowNum = 0; rowNum <= batchSize; rowNum++) {
      var row = {}
      next = resultSet.nextSync()
      if (!next) {
        endCursor = true
      }
      if (!next & rowNum != 0) {
          break
      }

      for (i = 1; i <= total_columns; i++) {
          key = resultSet.getMetaDataSync().getColumnLabelSync(i)
          if (next) {
              var value = resultSet.getStringSync(i)
          }
          else {
              var value = ""
          }
          row[key] = value
      }
      row.serviceRowNumber = resultSet.getRowSync()
      

      js.push(row)
  }
  return {
    connection : connName, 
    query : query, 
    resultId : uid, 
    data : js, 
    queryType : "query",
    endCursor,
  }
}


module.exports = {
    connections,
    checkConnections,
    getConnection,
    execQuery,
    reconnect,
    disconnect,
    testConnection,
    createConnection,
    metadataCatalog,
    getMetadataObject,
    ProcessResultSet,
    setDefaultCatalog,
}