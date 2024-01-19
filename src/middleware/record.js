import { body } from 'express-validator'
import db from '../db.js'

const recordExist = ({ field, table, column = 'id', target = body, message = 'Record not exist', type = 'uuid' }) =>
	target(field ?? column)
		[type === 'uuid' ? 'isUUID' : 'isString']()
		.notEmpty()
		.custom(async value => {
			const record = await db(table)
				.where({ [column]: value })
				.first()

			if (!record) {
				throw new Error(message)
			}
		})

const recordNotExist = ({ field, table, column, target = body, message = 'Record arleady exist', type = 'int' }) =>
	target(field ?? column)
		[type === 'int' ? 'isInt' : 'isString']()
		.notEmpty()
		.custom(async value => {
			const record = await db(table)
				.where({ [column]: value })
				.first()

			if (record) {
				throw new Error(message)
			}
		})

export { recordExist, recordNotExist }
