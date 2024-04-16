import './prototy-overrides.js'

import { query } from 'express-validator'
import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'

import { arrayColumn, omit } from './utils/index.js'
import { recordExist } from './middleware/record.js'
import validate from './middleware/validate.js'
import { uploadDir } from './consts.js'
import db from './db.js'

const defaultMapper = body => body

/**
 *
 * @param {{
 * 	select?: any;
 * 	table: string;
 * 	hasView?: boolean;
 * 	validations: any[];
 * 	primary_key?: string
 * 	hasAttachment?: boolean
 * 	createMapper?: (body: any) => any;
 * 	updateMapper?: (body: any) => any;
 * 	items?: {
 * 		table: string
 * 		field?: string
 * 		ref_column: string
 * 		primary_key?: string
 * 	}
 * }} params
 * @return {import('express').Router}
 */
const defineRoute = ({
	table,
	items,
	validations,
	select = '*',
	hasView = false,
	primary_key = 'id',
	hasAttachment = false,
	createMapper = defaultMapper,
	updateMapper = defaultMapper,
}) => {
	const router = Router()

	const hasItems = !!items
	const tableName = hasView ? `${table}_view` : table
	const { table: itemTable, field: itemField = 'items', ref_column, primary_key: itemPrimaryKey = 'id' } = items ?? {}

	router.get(
		'/index',
		validate([query('page').optional().isInt().toInt(), query('pageSize').optional().isInt().toInt(), query('pageSize').if(query('page').notEmpty()).default(10)]),
		async (req, res) => {
			try {
				const query = db.queryBuilder().select(select).from(tableName)

				if ('page' in req.query && 'pageSize' in req.query) {
					if (req.query.pageSize > 100) {
						req.query.pageSize = 100
					}

					query.offset((req.query.page - 1) * req.query.pageSize)
					query.limit(req.query.pageSize)

					const { count } = await query.clone().clearSelect().count().first()

					const pagination = {
						total: count,
						page: req.query.page,
						perPageSize: req.query.pageSize,
						pageCount: Math.ceil(count / req.query.pageSize),
					}

					res.setHeader('X-Pagination', JSON.stringify(pagination))
				}

				return res.status(200).json(await query)
			} catch (error) {
				return res.status(500).send(error)
			}
		},
	)

	router.get('/view', validate([recordExist({ table, target: query })]), async (req, res) => {
		try {
			const data = await db.queryBuilder().select(select).from(tableName).where(primary_key, req.query.id).first()

			if (hasItems) {
				data[itemField] = await db.queryBuilder().select('*').from(itemTable).where(ref_column, req.query.id)
			}

			return res.status(200).json(data)
		} catch (error) {
			return res.status(500).send(error)
		}
	})

	router.post('/create', validate(validations), async (req, res) => {
		const trx = await db.transaction()

		try {
			if (hasAttachment) {
				const file = req.files[0]

				const [{ id }] = await trx
					.queryBuilder()
					.insert({ file_name: path.basename(file.path) })
					.into('attachments')
					.returning('id')

				req.body.attachment_id = id
			}

			const result = await trx
				.queryBuilder()
				.insert(await createMapper(hasItems ? omit(req.body, itemField) : req.body))
				.into(table)
				.returning(primary_key)

			if (hasItems) {
				await trx
					.queryBuilder()
					.insert(
						req.body[itemField].map(item => ({
							[ref_column]: result[0][primary_key],
							...item,
						})),
					)
					.into(itemTable)
			}

			await trx.commit()

			return res.status(201).send()
		} catch (error) {
			await trx.rollback()

			if (hasAttachment) {
				await Promise.all(req.files.map(file => fs.rm(file.path, { force: true })))
			}

			return res.status(500).send(error)
		}
	})

	router.put('/update', validate([recordExist({ table, target: query }), ...validations]), async (req, res) => {
		const trx = await db.transaction()

		try {
			if (hasAttachment && req.files?.[0]) {
				const file = req.files[0]
				const { attachment_id } = await db.queryBuilder('attachment_id').select().from('games').where('id', req.query.id).first()

				const [{ id }] = await trx
					.queryBuilder()
					.update({ file_name: path.basename(file.path) })
					.where('id', attachment_id)
					.from('attachments')
					.returning('id')

				req.body.attachment_id = id
			}

			await trx
				.queryBuilder()
				.update(await updateMapper(hasItems ? omit(req.body, itemField) : req.body))
				.from(table)
				.where(primary_key, req.query.id)

			if (hasItems) {
				const currentItems = arrayColumn(await trx.queryBuilder().select('id').from(itemTable).where(ref_column, req.query.id), 'id')

				const updatedItems = []
				const newItems = []

				for (let i = 0; i < req.body[itemField].length; i++) {
					const item = req.body[itemField][i]

					if (!item.id) {
						newItems.push({ [ref_column]: req.query.id, ...item })
						continue
					}

					updatedItems.push(item)
				}

				const currentIds = arrayColumn(updatedItems, 'id')
				const deletedIds = [...currentItems].filter(id => !currentIds.includes(id))

				if (updatedItems.length > 0) {
					await Promise.all(updatedItems.map(item => trx.queryBuilder().update(omit(item, 'id')).from(itemTable).where(itemPrimaryKey, item.id)))
				}

				if (deletedIds.length > 0) {
					await Promise.all(deletedIds.map(id => trx.delete().from(itemTable).where(itemPrimaryKey, id)))
				}

				if (newItems.length > 0) {
					await trx.queryBuilder().insert(newItems).into(itemTable)
				}
			}

			await trx.commit()

			return res.status(204).send()
		} catch (error) {
			await trx.rollback()
			return res.status(500).send(error)
		}
	})

	router.delete('/delete', validate([recordExist({ table, target: query })]), async (req, res) => {
		const trx = await db.transaction()

		try {
			if (hasItems) {
				await trx.queryBuilder().delete().from(itemTable).where(ref_column, req.query.id)
			}

			if (hasAttachment) {
				const { attachment_id, file_name } = (await db.queryBuilder().select('attachment_id', 'file_name').from(table).where(primary_key, req.query.id)).first()

				if (attachment_id) {
					await trx.queryBuilder().delete().from('attachments').where('id', attachment_id)
					await fs.rm(path.json(uploadDir, file_name))
				}
			}

			await trx.queryBuilder().delete().from(table).where(primary_key, req.query.id)

			await trx.commit()

			return res.status(204).send()
		} catch (error) {
			await trx.rollback()
			return res.status(500).send(error)
		}
	})

	return router
}

export default defineRoute
