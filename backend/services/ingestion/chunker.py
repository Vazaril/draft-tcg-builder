from llama_index.core import Document
from llama_index.core.schema import IndexNode

def generate_card_nodes(cards_batch: list[dict]) -> list[Document]:
    return [
        Document(
            text=str(card["embedding_text"]),
            id_=str(card["oracle_id"]),
            metadata=card["metadata"],
            excluded_llm_metadata_keys=["legalities"]
        )
        for card in cards_batch
    ]

def generate_ruling_nodes(rulings_batch: list[dict]) -> list[IndexNode]:
    nodes = []
    for ruling in rulings_batch:
        node = IndexNode(
            id_=str(ruling["id"]),
            index_id=str(ruling["oracle_id"]),
            metadata=ruling["metadata"]
        )
        node.set_content(str(ruling["embedding_text"]))
        nodes.append(node)
    return nodes