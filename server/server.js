/* eslint-disable import/no-duplicates */
import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'

import axios from 'axios'

import cookieParser from 'cookie-parser'
import Html from '../client/html'

const { writeFile, readFile, unlink } = require('fs').promises

let connections = []

const port = process.env.PORT || 3000
const server = express()

server.use(cors())

server.use(express.static(path.resolve(__dirname, '../dist/assets')))
server.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }))
server.use(bodyParser.json({ limit: '50mb', extended: true }))

server.use(cookieParser())

//
// get /api/v1/users - получает всех юзеров из файла users.json, если его нет -получает данные с сервиса https://jsonplaceholder.typicode.com/users и заполняет файл users.json y и возвращает данные
// post /api/v1/users - добавляет юзера в файл users.json, с id равным id последнего элемента + 1 и возвращает {status: 'success', id: id}
// patch /api/v1/users/:userId - дополняет юзера в users.json с id равным userId и возвращает { status: 'success', id: userId }
// delete /api/v1/users/:userId - удаляет юзера в users.json с id равным userId и возвращает { status: 'success', id: userId }
// delete /api/v1/users/ - удаляет файл users.json

const wrFile = async (users) => {
  await writeFile(`${__dirname}/users.json`, JSON.stringify(users), { encoding: 'utf8' })
}

const rFile = () => {
  return readFile(`${__dirname}/users.json`, { encoding: 'utf8' })
    .then((data) => JSON.parse(data))
    .catch(async () => {
      const { data: users } = await axios.get('https://jsonplaceholder.typicode.com/users')
      await wrFile(users)
      return users
    })
}

server.get('/api/v1/users', async (req, res) => {
  const users = await rFile()
  res.json(users)
}) // read

server.post('/api/v1/users', async (req, res) => {
  const newUser = req.body // { "name": "ivan" }
  const users = await rFile()
  const newId = users[users.length - 1].id + 1
  const newUsers = [...users, { ...newUser, id: newId }]
  await wrFile(newUsers)
  res.json({ status: 'success', id: newId })
}) // read write
//
server.patch('/api/v1/users/:userId', async (req, res) => {
  const newUser = req.body // { "name": "ivan" }
  const { userId } = req.params
  const users = await rFile()
  const result = users.reduce((acc, rec) => {
    if (rec.id === +userId) {
      return [...acc, { ...rec, ...newUser }]
    }
    return [...acc, rec]
  }, [])
  await wrFile(result)
  res.json({ status: 'success', id: userId })
}) // read write

server.delete('/api/v1/users/:userId', async (req, res) => {
  const { userId } = req.params
  const users = await rFile()
  const result = users.filter((el) => el.id !== +userId)
  await wrFile(result)
  res.json({ status: 'success', id: userId })
})

server.delete('/api/v1/users', (req, res) => {
  unlink(`${__dirname}/users.json`)
  res.json({ status: 'deleted success' })
}) // delete file

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const echo = sockjs.createServer()
echo.on('connection', (conn) => {
  connections.push(conn)
  conn.on('data', async () => {})

  conn.on('close', () => {
    connections = connections.filter((c) => c.readyState !== 3)
  })
})

server.get('/', (req, res) => {
  // const body = renderToString(<Root />);
  const title = 'Server side Rendering'
  res.send(
    Html({
      body: '',
      title
    })
  )
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

echo.installHandlers(app, { prefix: '/ws' })

// eslint-disable-next-line no-console
console.log(`Serving at http://localhost:${port}`)
