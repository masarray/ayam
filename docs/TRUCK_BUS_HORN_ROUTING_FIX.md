# Truck and Bus Horn Routing Fix

Heavy vehicle horns now use explicit heavy-vehicle detection plus a width fallback.

Small cars keep the lighter `Diiiin` horn. Buses, container trucks, tankers, box trucks, articulated trucks, dump trucks, and tractor/heavy-width vehicles use the lower `THOTTT` truck/bus horn.

The trigger uses the vehicle front/nose edge instead of the vehicle center so the warning aligns with the approaching front of the vehicle.
