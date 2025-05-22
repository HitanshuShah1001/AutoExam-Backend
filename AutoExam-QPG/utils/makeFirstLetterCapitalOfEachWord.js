export function makeFirstLetterCapitalOfEachWord(name){
    let academyName = ""
    let words = name?.split(" ");
    words.forEach((n) => {
        let word = n?.charAt(0).toUpperCase() + n?.slice(1)
        academyName += word + " "
    }) 
    return academyName
    
}