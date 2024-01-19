Error.prototype.toJSON = function () {
	if (process.env.NODE_ENV === 'production') {
		return { message: 'Internal server error' }
	}

	return { name: this.name, message: this.message, stack: this.stack?.split('\n') }
}
