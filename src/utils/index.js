const omit = (object, ...keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)))

const arrayColumn = (array, field) => array.map(item => item[field])

export { omit, arrayColumn }
