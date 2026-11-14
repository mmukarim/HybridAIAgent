def get_text_statistics(text: str) -> dict[str, int]:
    words = text.split()
    num_words = len(words)
    num_characters = len(text)
    num_sentences = text.count('.') + text.count('!') + text.count('?')
    return {
        "word_count": num_words,
        "character_count": num_characters,
        "sentence_count": num_sentences
    }