from llama_index.core import Document
from llama_index.core.schema import IndexNode


def generate_card_nodes(cards_batch):
    nodes = []
    for card in cards_batch:
        text = f"{card.get('name', '')} - {card.get('type_line', '')}. Cost: {card.get('mana_cost', 'None')}. Text: {card.get('oracle_text', '')}"

        node = Document(
            text=text,
            id_=str(card.get('oracle_id', '')),
            metadata={
                "name": str(card.get('name', '')),
                "type": "card",
                "legalities": card.get('legalities', {})
            },
            excluded_llm_metadata_keys=["legalities"]
        )
        nodes.append(node)
    return nodes


def generate_ruling_nodes(rulings_batch):
    nodes = []
    for ruling in rulings_batch:
        node = IndexNode(
            id_=str(ruling.get('id', '')),
            index_id=str(ruling.get('oracle_id', '')),
            metadata={
                "type": "ruling",
                "date": str(ruling.get('published_at', ''))
            }
        )
        node.set_content(str(ruling.get('comment', '')))

        nodes.append(node)
    return nodes