
from app.services import vector_db
from app.config import settings
import sys

def check_db():
    print(f"Connecting...")
    client = vector_db.get_client()
    try:
        client.connect()
        count = vector_db.get_collection_count(client)
        print(f"Total recipes: {count}")
        
        print("\nSearching to inspect content...")
        # Create dummy vector of dimension 768
        dummy_vec = [0.0] * settings.EMBEDDING_DIMENSION
        
        # Search for top 10
        try:
            results = client.search(
                collection_name=settings.COLLECTION_NAME,
                query=dummy_vec,
                top_k=10,
                with_payload=True
            )
            
            print(f"Found {len(results)} results.")
            for i, r in enumerate(results):
                payload = r.payload
                title = payload.get("title", "No Title")
                steps = payload.get("num_steps")
                skill = payload.get("skill_level")
                
                print(f"Recipe {i}: {title}")
                print(f"  Steps: {steps}")
                print(f"  Skill: {skill}")
                
        except Exception as e:
            print(f"Search failed: {e}")
            
    finally:
        client.close()

if __name__ == "__main__":
    check_db()
