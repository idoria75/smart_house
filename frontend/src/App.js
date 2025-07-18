import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

const API_URL = process.env.REACT_APP_API_URL;

function App() {
  const [date, setDate] = useState(new Date());
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const yyyyMMdd = date.toISOString().slice(0, 10);
      const res = await fetch(`${API_URL}/api/data?date=${yyyyMMdd}`);
      const json = await res.json();
      setData(json);
    };
    fetchData();
  }, [date]);

  // Group data by sensor_ip
  const sensors = {};
  data.forEach((row) => {
    if (!sensors[row.sensor_ip]) sensors[row.sensor_ip] = [];
    sensors[row.sensor_ip].push({
      ...row,
      timestamp: new Date(row.timestamp).toLocaleTimeString(),
    });
  });

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Sensor Data Viewer</h1>
      <DatePicker selected={date} onChange={setDate} className="mb-4 p-2 border" />
      <div className="w-full h-96 bg-white rounded shadow p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart>
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            {Object.entries(sensors).map(([ip, readings]) => (
              <Line
                key={ip}
                data={readings}
                type="monotone"
                dataKey="temperature"
                name={`Temp ${ip}`}
                stroke="#f59e42"
                dot={false}
              />
            ))}
            {Object.entries(sensors).map(([ip, readings]) => (
              <Line
                key={ip + "-hum"}
                data={readings}
                type="monotone"
                dataKey="humidity"
                name={`Hum ${ip}`}
                stroke="#42a5f5"
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;
