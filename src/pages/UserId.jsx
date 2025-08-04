// src/pages/UserID.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const userIdToNameMap = {
  "2329839": "Sheeba",
  "2200178": "Aiman",
  "2137421": "Arshi",
  "2303671": "Ananta",
  "2383256": "Vennela",
  "2109892": "Komal",
  "640890": "Keerthi",
  "2304934": "Sneha",
  "2269819": "Parvesh",
  "939357": "Vaishali",
  "2380643": "Akash",
  "2299847": "Anshul",
  "2305484": "Kajal",
  "2311722": "Shanta",
  "2278035": "Shilpa",
  "2131830": "Kanav",
  "2184438": "Prabhsehaj",
  "2303266": "Stuti",
  "2113828": "Nor",
  "2334719": "Reshma",
  "2310351": "Sanhita",
  "2278532": "Madhan",
  "2315504": "Kanishka",
  "2163141": "Moumi",
  "2156627": "Mrinalani",
  "2366736": "Sravya",
  "2174522": "Syed",
  "2296897": "Atreyee",
  "2304834": "Ankita",
  "2305321": "Shohini",
  "2188749": "Karishma",
  "2307068": "Jyoshna",
  "2284289": "Zaibunissa",
  "2361242": "Vineet",
  "2187022": "Richa",
  "881871": "Mohammad",
  "2078632": "Sakshi",
  "2171869": "Jaweria",
  "2078539": "Surya",
  "2290965": "Anirban",
  "658342": "Sreejon",
  "895770": "Arif",
  "2236202": "Kamaljeet",
  "2302665": "Jayujyoti",
  "2363359": "Shilpa Sablok",
  "2278119": "Isha",
  "2120883": "Dashmeet",
  "2298667": "Debosmita",
  "2175681": "Tarun",
  "2294387": "Shivam",
  "2154990": "Parag",
  "2232031": "Yaswanth",
  "2078639": "Sunidhi",
  "2114449": "Sarrveshwaran",
  "2073274": "Priyanka",
  "2271590": "Ritika LNU",
  "2105623": "Surbhi",
  "2057057": "Anuraga",
  "2254379": "Shiva",
  "2307789": "Tahirul",
  "2051410": "Debasmita",
  "2299016": "Dhiraj",
  "2284270": "Swathi",
  "2157243": "Dhananjay",
  "2074839": "Nikhil",
};

function UserID() {
  const [userID, setUserID] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();

    const name = userIdToNameMap[userID];
    if (!name) {
      setError("Invalid Employee ID ❌");
      return;
    }

    localStorage.setItem("username", name);
    navigate("/region");
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-blue-50">
      <h1 className="text-2xl font-bold mb-4">Enter Your Employee ID</h1>
      <form onSubmit={handleSubmit} className="flex flex-col items-center">
        <input
          type="text"
          placeholder="Employee ID"
          value={userID}
          onChange={(e) => setUserID(e.target.value)}
          className="px-4 py-2 border rounded-md shadow-sm focus:outline-none"
        />
        {error && <p className="text-red-500 mt-2">{error}</p>}
        <button
          type="submit"
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Submit
        </button>
      </form>
    </div>
  );
}

export default UserID;
