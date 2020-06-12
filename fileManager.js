var fs = require('fs');
let execQuery = require("./connections").execQuery
const dirTree = require("directory-tree");

module.exports = function(app){
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
            const tree = dirTree("./store");
            res.send(tree)
        } catch (error) {
            res.send(error)
        }
    })


    app.post("/getOneFile", (req, res)  => {
        try {
            let query = fs.readFileSync(req.body.path, "utf8")
            let result = {
                query,
                filename : req.body.name
            }
            res.send(result)
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

    app.post("/deleteFile", (req, res)  => {
      try {
        let query = fs.unlinkSync(req.body.path)
        let result = {
            query,
            filename : req.body.name
        }
        res.send(result)
      } catch (error) {
          res.send(error)
      }
  })

    
}