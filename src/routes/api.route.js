import { param } from 'express-validator'
import multiparty from 'multiparty'
import { Router } from 'express'
import path from 'path'
import fs from 'fs'

import gameCategoryRoute from './game-categories.route.js'
import { recordExist } from '../middleware/record.js'
import tournamentsRoute from './tournaments.route.js'
import validate from '../middleware/validate.js'
import gamesRoute from './games.route.js'
import authRoute from './auth.route.js'
import db from '../db.js'
import { uploadDir } from '../consts.js'

const router = Router()

router.use('/auth', authRoute)
router.use('/tournaments', tournamentsRoute)
router.use('/game-categories', gameCategoryRoute)
router.use(
	'/games',
	(req, res, next) => {
		if (req.is('multipart/form-data')) {
			const form = new multiparty.Form({ uploadDir })

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

router.use('/files/:id', validate([recordExist({ target: param, table: 'attachments' })]), async (req, res) => {
	try {
		const attachment = await db.queryBuilder().select().from('attachments').where('id', req.params.id).first()
		const filePath = path.join(uploadDir, attachment.file_name)

		if (!fs.existsSync(filePath)) {
			return res.status(404).send()
		}

		return res.status(200).sendFile(filePath)
	} catch (error) {
		return res.status(200).json(error)
	}
})

export default router
