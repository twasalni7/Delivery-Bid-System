import { useState, useEffect } from "react";

export function useDriverSession() {
  const [driverId, setDriverIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem("swiftbid_driver_id");
    return stored ? parseInt(stored, 10) : null;
  });

  const setDriverId = (id: number | null) => {
    if (id === null) {
      localStorage.removeItem("swiftbid_driver_id");
    } else {
      localStorage.setItem("swiftbid_driver_id", id.toString());
    }
    setDriverIdState(id);
  };

  return { driverId, setDriverId };
}
