import defineRoute from '../defineRoute.js'
import { body } from 'express-validator'
import db from '../db.js'

const router = defineRoute({ table: 'game_categories', validations: [body('name').isString().notEmpty()] })

router.get('/with-games', async (req, res) => {
	try {
		const gameCategories = await db.queryBuilder().select('*').from('game_categories')
		const games = await db.queryBuilder().select('*').from('games')

		const indexedGames = {}

		games.forEach(game => {
			if (game.category_id in indexedGames) {
				indexedGames[game.category_id].push(game)
			} else {
				indexedGames[game.category_id] = [game]
			}
		})

		return res.status(200).json(gameCategories.map(category => ({ ...category, games: indexedGames[category.id] })))
	} catch (error) {
		return res.status(500).json(error)
	}
})

export default router
