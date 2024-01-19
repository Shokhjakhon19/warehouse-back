import defineRoute from '../defineRoute.js'
import { body } from 'express-validator'

const router = defineRoute({ table: 'game_categories', validations: [body('name').isString().notEmpty()] })

export default router
