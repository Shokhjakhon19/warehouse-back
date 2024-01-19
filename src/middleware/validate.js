import { validationResult, matchedData } from 'express-validator'

const validate = (validations, returnAsResponse = true) => {
	return async (req, res, next) => {
		for (let validation of validations) {
			const result = await validation.run(req)

			if (result.errors.length) break
		}

		const errors = validationResult(req)

		if (errors.isEmpty()) {
			req.unsafeBody = structuredClone(req.body)
			req.body = matchedData(req, { onlyValidData: true, locations: ['body'] })

			return next()
		}

		const result = errors.formatWith(error => error.msg).mapped()

		if (returnAsResponse) {
			return res.status(400).json(result)
		}

		req.validationErrors = result

		next()
	}
}

export default validate
