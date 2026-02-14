
import requests
import json

def test_scan():
    url = "http://localhost:8000/api/scan"
    
    # Create a dummy image
    image_content = b"fake_image_bytes"
    files = {
        "image": ("test.jpg", image_content, "image/jpeg")
    }
    
    data = {
        "preferences": json.dumps({})
    }
    
    try:
        response = requests.post(url, files=files, data=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_scan()
