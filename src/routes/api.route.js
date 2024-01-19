import { Router } from 'express'

import gameCategoryRoute from './game-categories.route.js'
import gamesRoute from './games.route.js'
import authRoute from './auth.route.js'
import multiparty from 'multiparty'
import path from 'path'

const router = Router()

router.use('/auth', authRoute)
router.use('/game-categories', gameCategoryRoute)
router.use(
	'/games',
	(req, res, next) => {
		if (req.is('multipart/form-data')) {
			const form = new multiparty.Form({
				uploadDir: path.resolve('uploads'),
			})

			form.parse(req, (error, fields, { file }) => {
				if (error) {
					return next(error)
				}

				req.files = file
				req.body = Object.fromEntries(
					Object.entries(fields).map(([key, value]) => {
						if (Array.isArray(value) && value.length === 1) {
							return [key, value[0]]
						}

						return [key, value]
					}),
				)

				next()
			})
		} else {
			next()
		}
	},
	gamesRoute,
)

export default router
