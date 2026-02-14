
from app.services import vector_db
import sys

def check_count():
    print(f"Getting client...")
    client = vector_db.get_client()
    print(f"Client object: {client}")
    
    if client is None:
        print("Error: Client is None")
        return

    try:
        print("Connecting to DB...")
        client.connect()
        print("Connected.")
        
        print("Checking count...")
        try:
            count = vector_db.get_collection_count(client)
            print(f"Total recipes in DB: {count}")
        except Exception as e:
            print(f"Error calling get_collection_count: {e}")
            
    except Exception as e:
        print(f"Error during connection or check: {e}")
    finally:
        try:
            client.close()
            print("Client closed.")
        except:
            pass

if __name__ == "__main__":
    check_count()
