const getLanguage = () => {
    if(window && window.navigator && window.navigator.language && window.navigator.language.includes('zh')) {
        return 'ZH'
    }
    return 'EN'
}

export { getLanguage }