class ResponseError extends Error {
	constructor(message) {
		super(message)
	}
}

class Unauthorized extends ResponseError {
	status = 401

	constructor() {
		super('Unauthorized!')
	}
}

export { Unauthorized, ResponseError }
