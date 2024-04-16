import './prototy-overrides.js'

import express from 'express'
import logger from 'morgan'
import cors from 'cors'
import util from 'util'

import apiRouter from './routes/api.route.js'
import { ResponseError } from './errors.js'

const app = express()

logger.token('body', req => {
	return util.format(req.body)
})

app.use(logger(':method :url :status :response-time ms - :res[content-length] :body'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(
	cors({
		credentials: true,
		exposedHeaders: ['X-Pagination'],
		origin: ['http://localhost:7895'],
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	}),
)

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
