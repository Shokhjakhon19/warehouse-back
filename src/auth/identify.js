import jwt from 'jsonwebtoken'
import fs from 'fs/promises'
import path from 'path'

import { Unauthorized } from '../errors.js'
import db from '../db.js'

const publicRoutes = ['auth/login']
const publicKey = await fs.readFile(path.resolve('keys/public.key'))

const identify = async (req, res, next) => {
	if (publicRoutes.includes(req.path.replace(/^\//, ''))) return next()

	const header = req.headers.authorization

	if (!header) return next(new Unauthorized())

	try {
		const token = jwt.verify(header.split(' ')[1], publicKey, { algorithm: 'RS256', issuer: `${req.protocol}://${req.get('host')}` })

		const user = await db.queryBuilder().select('u.*').from({ u: 'users' }).where({ username: token.username }).first()

		if (!user) return next(new Unauthorized())

		req.user = user

		return next()
	} catch (error) {
		return next(new Unauthorized())
	}
}

export default identify
