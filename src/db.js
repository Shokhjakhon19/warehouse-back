import config from '../knexfile.js'
import knex from 'knex'

const db = knex({ ...config[process.env.NODE_ENV ?? 'development'], wrapIdentifier: identifier => identifier })

export default db
