let fs = require('fs');
let {execQuery} = require("./connections")


function executeFile(filename, database) {
  try {
    let file = fs.readFileSync(`./store/${filename}`, "utf8")
    let output = execQuery(database, file, 0)
    let result = {
        file,
        result : output
    }
    return result
  } catch (error) {
      return error
  }
}


module.exports = {
  executeFile,
}