const omit = (object, ...keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)))

const arrayColumn = (array, field) => array.map(item => item[field])

const shuffle = array => {
	let currentIndex = array.length,
		randomIndex

	while (currentIndex > 0) {
		randomIndex = Math.floor(Math.random() * currentIndex)
		currentIndex--
		;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
	}

	return array
}

export { omit, arrayColumn, shuffle }
