import { body, param, query } from 'express-validator'
import { InMemoryDatabase } from 'brackets-memory-db'
import { BracketsManager } from 'brackets-manager'
import validate from '../middleware/validate.js'
import defineRoute from '../defineRoute.js'
import { uploadDir } from '../consts.js'
import db from '../db.js'
import path from 'path'
import fs from 'fs'

const router = defineRoute({
	hasView: true,
	table: 'tournaments',
	validations: [body('name').notEmpty().isString(), body('game_id').notEmpty().isUUID(), body('reg_start_date').notEmpty().isISO8601(), body('start_date').isString().isISO8601()],
})

router.get('/by-game/:id', validate([param('id').notEmpty().isUUID()]), async (req, res) => {
	try {
		const game = await db.queryBuilder().select('*').from('games').where('id', req.params.id).first()

		const tournament = await db.queryBuilder().select('*').from('tournaments').where('game_id', req.params.id).whereIn('status', ['NOT_STARTED', 'REG_STARTED']).first()

		return res.status(200).json({ ...game, tournament })
	} catch (error) {
		return res.status(500).json(error)
	}
})

router.get('/teams', validate([query('tournament_id').notEmpty().isUUID()]), async (req, res) => {
	try {
		const result = await db.queryBuilder().select('*').from('tournament_teams').where('tournament_id', req.query.tournament_id).orderBy('registered_at', 'asc')

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
		body('captain_phone_number').notEmpty().isString(),
	]),
	async (req, res) => {
		try {
			const tournament = await db.queryBuilder().select().from('tournaments').where('id', req.body.tournament_id).first()

			if (tournament.status === 'NOT_STARTED') {
				return res.status(400).json({ message: 'Turnir hali boshlanmadi' })
			}

			if (tournament.status === 'STARTED') {
				return res.status(400).json({ message: "Turnirga ro'yhatdan o'tish tug'adi" })
			}

			const { count } = await db.queryBuilder().count().from('tournament_teams').where('tournament_id', req.body.tournament_id).first()

			if (+count >= 16) {
				return res.status(400).json({ message: "Joylar to'lib bo'ldi" })
			}

			const trx = await db.transaction()

			try {
				await trx.queryBuilder().insert(req.body).into('tournament_teams')

				await trx.commit()

				return res.status(201).send()
			} catch (error) {
				await trx.rollback()
				return res.status(500).json(error)
			}
		} catch (error) {
			return res.status(500).json(error)
		}
	},
)

router.post('/start', validate([body('tournament_id').notEmpty().isUUID()]), async (req, res) => {
	const trx = await db.transaction()
	const bracketsJson = path.resolve(uploadDir, `${req.body.tournament_id}.json`)
	const bracketsJsonExists = fs.existsSync(bracketsJson)

	try {
		const tournament = await trx.queryBuilder().select().from('tournaments').where('id', req.body.tournament_id).first()

		if (tournament.status !== 'NOT_STARTED') {
			return res.status(400).json({ message: "Turnir boshlanib bo'lgan" })
		}

		if (tournament.start_date < Date.now()) {
			return res.status(400).json({ message: 'Turnir boshlanish vaqti kelmagan' })
		}

		if (bracketsJsonExists) {
			return res.status(400).json({ message: "Qur'a tashlanib bo'lgan" })
		}

		const storage = new InMemoryDatabase()
		const manager = new BracketsManager(storage)

		const teams = await trx
			.queryBuilder()
			.select('id', { name: 'team_name' }, 'tournament_id')
			.from('tournament_teams')
			.where('tournament_id', req.body.tournament_id)
			.andWhere('is_banned', false)

		await manager.create.stage({
			seeding: teams,
			name: tournament.name,
			type: 'single_elimination',
			tournamentId: tournament.id,
			settings: {
				size: 16,
				grandFinal: 'simple',
				roundRobinMode: 'simple',
			},
		})

		const currentStage = await manager.get.currentStage(tournament.id)
		const matches = await manager.get.currentMatches(currentStage.id)

		await trx
			.insert(
				matches.map(match => ({
					external_id: match.id,
					tournament_id: tournament.id,
					team1_id: match.opponent1.id,
					team2_id: match.opponent2.id,
					stage: tournament.current_stage,
				})),
			)
			.into('tournament_history')

		await fs.promises.writeFile(bracketsJson, JSON.stringify(await manager.export(), null, 3))

		await trx.commit()

		return res.status(201).json()
	} catch (error) {
		await trx.rollback()

		if (bracketsJsonExists) {
			await fs.promises.rm(bracketsJson)
		}

		return res.status(500).json(error)
	}
})

router.post(
	'/define-winner',
	validate([body('match_id').notEmpty().isInt(), body('winner_id').notEmpty().isUUID(), body('tournament_id').notEmpty().isUUID()]),
	async (req, res) => {
		const bracketsJson = path.resolve(uploadDir, `${req.body.tournament_id}.json`)
		const bracketsJsonExists = fs.existsSync(bracketsJson)

		if (!bracketsJsonExists) {
			return res.status(400).json({ message: 'Fayl topilmadi' })
		}

		const bracketsContent = JSON.parse(await fs.promises.readFile(bracketsJson))

		const trx = await db.transaction()

		try {
			const tournament = await trx.queryBuilder().select().from('tournaments').where('id', req.body.tournament_id).first()

			if (tournament.current_stage === '1') {
				return res.status(400).json({ message: "Turnir yakunlanib bo'lgan!" })
			}

			const history = await trx.queryBuilder().select().from('tournament_history').where('tournament_id', tournament.id).andWhere('external_id', req.body.match_id).first()

			const looser_id = history.team1_id === req.body.winner_id ? history.team2_id : history.team1_id
			const looserTeam = history.team1_id === req.body.winner_id ? 2 : 1

			await trx.queryBuilder().update({ winner_id: req.body.winner_id }).from('tournament_history').where('id', history.id).andWhere('tournament_id', tournament.id)

			await trx.queryBuilder().update({ is_banned: true }).from('tournament_teams').where('tournament_id', tournament.id).andWhere('id', looser_id)

			const storage = new InMemoryDatabase()

			storage.setData(bracketsContent)

			const manager = new BracketsManager(storage)

			const winnerScore = { score: 1, result: 'win' }
			const looserScore = { score: 0, result: 'loss' }

			await manager.update.match({
				id: history.external_id,
				opponent1: Object.assign(looserTeam === 1 ? looserScore : winnerScore, { id: history.team1_id }),
				opponent2: Object.assign(looserTeam === 2 ? looserScore : winnerScore, { id: history.team2_id }),
			})

			if (tournament.current_stage !== '1') {
				const stage = await manager.get.currentStage(tournament.id)
				const round = await manager.get.currentRound(stage.id)

				if (tournament.current_stage !== getStageFromIndex(round.id)) {
					const nextStage = getStageFromIndex(round.id)

					await trx.update({ current_stage: nextStage }).from('tournaments').where('id', tournament.id)

					const matches = await manager.get.currentMatches(stage.id)

					await trx
						.insert(
							matches.map(match => ({
								stage: nextStage,
								external_id: match.id,
								tournament_id: tournament.id,
								team1_id: match.opponent1.id,
								team2_id: match.opponent2.id,
							})),
						)
						.into('tournament_history')
				}
			}

			await fs.promises.writeFile(bracketsJson, JSON.stringify(await manager.export(), null, 3))

			await trx.commit()

			return res.status(200).send()
		} catch (error) {
			await trx.rollback()
			return res.status(500).json(error)
		}
	},
)

router.get('/bracket/:id', validate([param('id').notEmpty().isUUID()]), async (req, res) => {
	try {
		const bracketsJson = path.resolve(uploadDir, `${req.params.id}.json`)

		if (!fs.existsSync(bracketsJson)) {
			return res.status(400).json({ message: "Qu'ra tashlanmagan" })
		}

		const stream = fs.createReadStream(bracketsJson)

		stream.pipe(res.contentType('json'))
	} catch (error) {
		return res.status(500).json(error)
	}
})

const getStageFromIndex = index => {
	switch (index) {
		case 0:
			return '1/8'
		case 1:
			return '1/4'
		case 2:
			return '1/2'
		case 3:
			return '1'
	}
}

export default router
