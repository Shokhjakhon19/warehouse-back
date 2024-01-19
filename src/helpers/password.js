import crypto from 'crypto'

const createPasswordHash = (password, salt) =>
	new Promise((resolve, reject) => {
		crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, buffer) => {
			if (err) {
				return reject(err)
			}

			resolve(buffer.toString('hex'))
		})
	})

const validatePasswordHash = (password, hashedPassword, salt) =>
	new Promise(async (resolve, reject) => {
		try {
			const generated = await createPasswordHash(password, salt)

			resolve(generated === hashedPassword)
		} catch (error) {
			reject(error)
		}
	})

export { createPasswordHash, validatePasswordHash }
