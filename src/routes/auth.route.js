import { validatePasswordHash } from '../helpers/password.js'
import { recordExist } from '../middleware/record.js'
import validate from '../middleware/validate.js'
import { body } from 'express-validator'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import fs from 'fs/promises'
import db from '../db.js'

const router = Router()

const privateKey = await fs.readFile('keys/private.key')

router.get('/me', async (req, res) => {
	try {
		return res.status(200).json({ user: req.user })
	} catch (error) {
		return res.status(500).json(error)
	}
})

router.post(
	'/login',
	validate([body('username').isString().notEmpty(), body('password').isString().notEmpty(), recordExist({ column: 'username', table: 'users', type: 'string' })], false),
	async (req, res) => {
		try {
			const error = { username: 'Username or password incorrect', password: 'Username or password incorrect' }

			if (req.validationErrors) return res.status(400).json(error)

			const [{ password, ...user }] = await db.select('u.*').from({ u: 'users' }).where({ username: req.body.username })

			if (!(await validatePasswordHash(req.body.password, password, user.id))) {
				return res.status(400).json(error)
			}

			const token = jwt.sign({ username: user.username }, privateKey, {
				expiresIn: '24h',
				algorithm: 'RS256',
				issuer: `${req.protocol}://${req.get('host')}`,
			})

			return res.status(200).json({ user, token })
		} catch (error) {
			return res.status(500).json(error)
		}
	},
)

export default router
