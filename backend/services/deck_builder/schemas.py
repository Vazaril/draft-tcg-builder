from pydantic import BaseModel, Field

class DeckCategory(BaseModel):
    name: str = Field(description="Name of the category (e.g., Ramp, Synergy, Removal)")
    quota: int = Field(description="Number of cards allocated to this category")
    search_query: str = Field(description="Keywords for vector search")

class DeckBlueprint(BaseModel):
    commander: str | None = Field(description="Name of the commander, if applicable")
    color_identity: list[str] = Field(description="List of MTG colors: W, U, B, R, G. Empty list for colorless.")
    format: str = Field(description="Format legality (e.g., commander, standard)")
    categories: list[DeckCategory] = Field(description="Functional categories summing to the required non-land card count")
    land_count: int = Field(description="Total number of lands required")

class CardScore(BaseModel):
    card_id: str = Field(description="The exact ID of the card being scored")
    score: int = Field(description="0-10 fit rating for the category and deck strategy", ge=0, le=10)
    quantity: int = Field(description="Suggested number of copies (1 for Commander, 1-4 for Standard)")
    reasoning: str = Field(description="Max 5 words reasoning for the score")

class CategoryScores(BaseModel):
    scores: list[CardScore]