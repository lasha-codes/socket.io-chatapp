const express = require('express')
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const app = express()
const cors = require('cors')
const bcrypt = require('bcryptjs')
const User = require('./models/User.js')
const cookieParser = require('cookie-parser')
const ws = require('ws')

dotenv.config()
mongoose.connect(process.env.MONGO_URL)
const jwtSecret = process.env.JWT_SECRET
const bcryptSalt = bcrypt.genSaltSync(10)

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())

app.get('/test', (req, res) => {
  res.json('test ok')
})

app.get('/profile', (req, res) => {
  const { token } = req.cookies
  if (!token) {
    return
  }
  try {
    jwt.verify(token, jwtSecret, {}, (err, userData) => {
      if (err) throw err

      res.json(userData)
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

app.post('/login', async (req, res) => {
  const { username, password } = req.body
  try {
    const foundUser = await User.findOne({ username })

    if (foundUser) {
      const passOk = bcrypt.compareSync(password, foundUser.password)
      if (passOk) {
        jwt.sign(
          { userId: foundUser._id, username },
          jwtSecret,
          {},
          (err, token) => {
            if (err) throw err
            res.cookie('token', token).json({
              id: foundUser._id,
            })
          }
        )
      } else {
        res.status(400).json({ message: 'username is not valid' })
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

app.post('/register', async (req, res) => {
  const { username, password } = req.body
  try {
    const hashedPassword = bcrypt.hashSync(password, bcryptSalt)
    const createdUser = await User.create({
      username,
      password: hashedPassword,
    })
    jwt.sign(
      { userId: createdUser._id, username },
      jwtSecret,
      {},
      (err, token) => {
        if (err) throw err
        res.cookie('token', token).status(201).json({ _id: createdUser._id })
      }
    )
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

const server = app.listen(4000, () => {
  console.log('Server running')
})

const wss = new ws.WebSocketServer({ server })
wss.on('connection', (connection, req) => {
  const cookies = req.headers.cookie
  if (cookies) {
    const tokenCookieString = cookies.split(';').find((str) => {
      return str.trim().startsWith('token=')
    })
    if (tokenCookieString) {
      const token = tokenCookieString.split('=')[1]
      if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
          if (err) throw err
          const { userId, username } = userData
          connection.userId = userId
          connection.username = username
        })
      }
    }
  }

  console.log(
    [...wss.clients].map((c) => {
      return c.username
    })
  )
})
