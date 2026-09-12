from pydantic import BaseModel, Field

class DeckCategory(BaseModel):
    name: str = Field(description="Name of the category (e.g., Ramp, Synergy, Removal)")
    quota: int = Field(description="Number of cards allocated to this category")
    search_query: str = Field(description="Ideal keywords for vector search (e.g., 'destroy target creature')")

class DeckBlueprint(BaseModel):
    commander: str | None = Field(description="Name of the commander, if applicable")
    color_identity: list[str] = Field(description="List of MTG color letters: W, U, B, R, G")
    format: str = Field(description="Format legality (e.g., commander, standard, modern)")
    categories: list[DeckCategory] = Field(description="Non-land categories summing to the required non-land card count")
    land_count: int = Field(description="Total number of lands required")

class CardSelection(BaseModel):
    selected_card_names: list[str] = Field(description="List of exactly the requested number of card names")