import './prototy-overrides.js'

import express from 'express'
import logger from 'morgan'

import apiRouter from './routes/api.route.js'
import { ResponseError } from './errors.js'
import identify from './auth/identify.js'

const app = express()

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use('/api', apiRouter)

app.use('*', (req, res) => {
	return res.status(404).json({ message: `Can't ${req.method} ${req.originalUrl}` })
})

app.use((error, req, res, next) => {
	if (res.headersSent) {
		return next(error)
	}

	if (error instanceof ResponseError) {
		return res.status(error.status).json({ message: error.message })
	}

	if (process.env.NODE_ENV === 'production') {
		return res.status(500)
	} else {
		return res.status(500).json(error)
	}
})

export default app
