import defineRoute from '../defineRoute.js'
import { body, query } from 'express-validator'
import validate from '../middleware/validate.js'
import db from '../db.js'

const router = defineRoute({
	table: 'tournaments',
	validations: [body('game_id').notEmpty().isUUID(), body('reg_start_date').notEmpty().isISO8601(), body('start_date').isString().isISO8601()],
})

router.get('/teams', validate([query('tournament_id').notEmpty().isUUID()]), async (req, res) => {
	try {
		const result = await db.queryBuilder().select('*').from('tournament_teams').where('tournament_id', req.query.tournament_id)

		return res.status(200).json(result)
	} catch (error) {
		return res.status(500).json(error)
	}
})

router.post(
	'/register-team',
	validate([
		body('tournament_id').notEmpty().isUUID(),
		body('team_name').notEmpty().isString(),
		body('captain_name').notEmpty().isString(),
		body('captain_phone_number').notEmpty().isString().isMobilePhone('uz-Uz'),
	]),
	async (req, res) => {
		const trx = await db.transaction()

		try {
			await trx.queryBuilder().insert(req.body).into('tournament_teams')

			await trx.commit()

			return res.status(201).send()
		} catch (error) {
			await trx.rollback()
			return res.status(500).json(error)
		}
	},
)

router.post('/make', validate([body('tournament_id').notEmpty().isUUID()]), async (req, res) => {
	try {
		const teams = await db.queryBuilder().select('*').from('tournament_teams').where('tournament_id', req.body.tournament_id)

		return res.status(200).json(teams)
	} catch (error) {
		return res.status(500).json(error)
	}
})

export default router
