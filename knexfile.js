/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */
export default {
	development: {
		client: 'postgresql',
		connection: {
			user: 'postgres',
			password: '5555',
			database: 'game',
			host: 'localhost',
			pool: 5432,
		},
	},
	production: {
		client: 'postgresql',
		connection: {
			user: 'username',
			database: 'my_db',
			password: 'password',
		},
		pool: {
			min: 2,
			max: 10,
		},
		migrations: {
			tableName: 'knex_migrations',
		},
	},
}
