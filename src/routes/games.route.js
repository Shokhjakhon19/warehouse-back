import defineRoute from '../defineRoute.js'
import { body } from 'express-validator'

const router = defineRoute({
	table: 'games',
	hasAttachment: true,
	validations: [
		body('category_id').notEmpty().isUUID(),
		body('name').isString().notEmpty(),
		body('description').isString().default(null),
	],
})

export default router
