
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Mapbox from "@rnmapbox/maps";

import "../config/mapbox";

import { getAuth } from "@react-native-firebase/auth";


// ======================================================
// TYPES
// ======================================================

type OnlineUser = {
  user_id: string;
  displayName: string;
  latitude: number;
  longitude: number;
};

type SocketMessage = {
  type:
    | "user_online"
    | "user_offline"
    | "user_location";

  user_id?: string;

  data?: OnlineUser;
};


// ======================================================
// COMPONENT
// ======================================================

export default function Index() {
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<Mapbox.Camera>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const locationSubscriptionRef =
    useRef<Location.LocationSubscription | null>(null);

  const auth = getAuth();
  const currentUser = auth.currentUser;


  // ====================================================
  // LOCATION
  // ====================================================

  const [myLocation, setMyLocation] =
    useState<Location.LocationObject | null>(null);

  const [locationReady, setLocationReady] =
    useState(false);

  const [locationPermission, setLocationPermission] =
    useState<boolean | null>(null);


  // ====================================================
  // CAMERA
  // ====================================================

  const [zoomLevel, setZoomLevel] =
    useState(15);

  const [cameraCenter, setCameraCenter] =
    useState<{
      latitude: number;
      longitude: number;
    } | null>(null);


  // ====================================================
  // USERS
  // ====================================================

  const [onlineUsers, setOnlineUsers] =
    useState<Record<string, OnlineUser>>({});

  const [selectedUserId, setSelectedUserId] =
    useState<string | null>(null);


  // ====================================================
  // UI
  // ====================================================

  const [menuOpen, setMenuOpen] =
    useState(false);

  const [socketConnected, setSocketConnected] =
    useState(false);


  // ====================================================
  // INITIAL GPS LOCATION
  // ====================================================

  useEffect(() => {
    let mounted = true;

    const initializeLocation = async () => {
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (!mounted) return;

        if (
          status !==
          Location.PermissionStatus.GRANTED
        ) {
          setLocationPermission(false);
          return;
        }

        setLocationPermission(true);

        const current =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

        if (!mounted) return;

        setMyLocation(current);

        setCameraCenter({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });

        setLocationReady(true);
      } catch (error) {
        console.log(
          "Initial location error:",
          error
        );
      }
    };

    initializeLocation();

    return () => {
      mounted = false;
    };
  }, []);


  // ====================================================
  // CONTINUOUS GPS TRACKING
  // ====================================================

  useEffect(() => {
    if (!locationReady || !currentUser) {
      return;
    }

    let mounted = true;

    const startTracking = async () => {
      try {
        const subscription =
          await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 2000,
              distanceInterval: 3,
            },
            (location) => {
              if (!mounted) return;

              setMyLocation(location);

              // Do NOT move the map here.
              //
              // The user can:
              // - drag the map
              // - view another user
              // - zoom anywhere
              //
              // GPS updates only update our location.

              const ws =
                websocketRef.current;

              if (
                ws &&
                ws.readyState ===
                  WebSocket.OPEN
              ) {
                ws.send(
                  JSON.stringify({
                    latitude:
                      location.coords.latitude,

                    longitude:
                      location.coords.longitude,

                    displayName:
                      currentUser.displayName ||
                      currentUser.email ||
                      `User ${currentUser.uid.slice(
                        0,
                        6
                      )}`,
                  })
                );
              }
            }
          );

        locationSubscriptionRef.current =
          subscription;
      } catch (error) {
        console.log(
          "GPS tracking error:",
          error
        );
      }
    };

    startTracking();

    return () => {
      mounted = false;

      locationSubscriptionRef.current?.remove();

      locationSubscriptionRef.current = null;
    };
  }, [locationReady, currentUser]);


  // ====================================================
  // WEBSOCKET
  // ====================================================

  useEffect(() => {
    if (!locationReady || !currentUser) {
      return;
    }

    const userId = currentUser.uid;

    const ws = new WebSocket(
      `wss://my-live-location-api.onrender.com/ws/${userId}`
    );

    websocketRef.current = ws;

    ws.onopen = () => {
      console.log(
        "WebSocket connected"
      );

      setSocketConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message: SocketMessage =
          JSON.parse(event.data);


        // ----------------------------------------------
        // USER LOCATION
        // ----------------------------------------------

        if (
          message.type ===
            "user_location" &&
          message.data
        ) {
          const user = message.data;

          if (user.user_id === userId) {
            return;
          }

          setOnlineUsers((previous) => ({
            ...previous,
            [user.user_id]: user,
          }));
        }


        // ----------------------------------------------
        // USER ONLINE
        // ----------------------------------------------

        if (
          message.type ===
            "user_online" &&
          message.user_id
        ) {
          console.log(
            "User online:",
            message.user_id
          );
        }


        // ----------------------------------------------
        // USER OFFLINE
        // ----------------------------------------------

        if (
          message.type ===
            "user_offline" &&
          message.user_id
        ) {
          setOnlineUsers((previous) => {
            const updated = {
              ...previous,
            };

            delete updated[
              message.user_id!
            ];

            return updated;
          });

          setSelectedUserId(
            (current) =>
              current ===
              message.user_id
                ? null
                : current
          );
        }
      } catch (error) {
        console.log(
          "WebSocket message error:",
          error
        );
      }
    };

    ws.onerror = (error) => {
      console.log(
        "WebSocket error:",
        error
      );

      setSocketConnected(false);
    };

    ws.onclose = () => {
      console.log(
        "WebSocket disconnected"
      );

      setSocketConnected(false);
    };

    return () => {
      ws.close();

      websocketRef.current = null;

      setSocketConnected(false);
    };
  }, [locationReady, currentUser]);


  // ====================================================
  // CAMERA CHANGE
  // ====================================================

  const handleCameraChanged =
    useCallback((event: any) => {
      try {
        const center =
          event?.properties?.center;

        const zoom =
          event?.properties?.zoom;

        if (
          Array.isArray(center) &&
          center.length >= 2
        ) {
          setCameraCenter({
            longitude: center[0],
            latitude: center[1],
          });
        }

        if (
          typeof zoom === "number"
        ) {
          setZoomLevel(zoom);
        }
      } catch (error) {
        console.log(
          "Camera change error:",
          error
        );
      }
    }, []);


  // ====================================================
  // ZOOM IN
  // ====================================================

  const zoomIn = useCallback(() => {
    const nextZoom = Math.min(
      zoomLevel + 1,
      20
    );

    cameraRef.current?.setCamera({
      zoomLevel: nextZoom,
      animationDuration: 250,
      animationMode: "easeTo",
    });

    setZoomLevel(nextZoom);
  }, [zoomLevel]);


  // ====================================================
  // ZOOM OUT
  // ====================================================

  const zoomOut = useCallback(() => {
    const nextZoom = Math.max(
      zoomLevel - 1,
      1
    );

    cameraRef.current?.setCamera({
      zoomLevel: nextZoom,
      animationDuration: 250,
      animationMode: "easeTo",
    });

    setZoomLevel(nextZoom);
  }, [zoomLevel]);


  // ====================================================
  // GO TO MY LOCATION
  // ====================================================

  const goToMyLocation =
    useCallback(() => {
      if (!myLocation) return;

      const latitude =
        myLocation.coords.latitude;

      const longitude =
        myLocation.coords.longitude;

      const nextZoom = Math.max(
        zoomLevel,
        15
      );

      setSelectedUserId(null);

      cameraRef.current?.setCamera({
        centerCoordinate: [
          longitude,
          latitude,
        ],

        zoomLevel: nextZoom,

        animationDuration: 700,

        animationMode: "flyTo",
      });

      setCameraCenter({
        latitude,
        longitude,
      });

      setZoomLevel(nextZoom);
    }, [myLocation, zoomLevel]);


  // ====================================================
  // SELECT ONLINE USER
  // ====================================================

  const selectUser = useCallback(
    (user: OnlineUser) => {
      setSelectedUserId(
        user.user_id
      );

      setMenuOpen(false);

      cameraRef.current?.setCamera({
        centerCoordinate: [
          user.longitude,
          user.latitude,
        ],

        zoomLevel,

        animationDuration: 700,

        animationMode: "flyTo",
      });

      setCameraCenter({
        latitude: user.latitude,
        longitude: user.longitude,
      });
    },
    [zoomLevel]
  );


  // ====================================================
  // LOCATION PERMISSION SCREEN
  // ====================================================

  if (locationPermission === false) {
    return (
      <SafeAreaView
        style={[
          styles.centerScreen,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <Text style={styles.errorTitle}>
          Location Permission Required
        </Text>

        <Text style={styles.errorText}>
          This app needs your GPS location
          to show your position on the map.
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={async () => {
            const { status } =
              await Location.requestForegroundPermissionsAsync();

            if (
              status ===
              Location.PermissionStatus.GRANTED
            ) {
              setLocationPermission(true);

              try {
                const current =
                  await Location.getCurrentPositionAsync(
                    {
                      accuracy:
                        Location.Accuracy.High,
                    }
                  );

                setMyLocation(current);

                setCameraCenter({
                  latitude:
                    current.coords.latitude,
                  longitude:
                    current.coords.longitude,
                });

                setLocationReady(true);
              } catch (error) {
                console.log(error);
              }
            }
          }}
        >
          <Text style={styles.retryText}>
            Allow Location
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }


  // ====================================================
  // WAIT FOR GPS
  // ====================================================

  if (
    !locationReady ||
    !myLocation
  ) {
    return (
      <SafeAreaView
        style={[
          styles.centerScreen,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <ActivityIndicator size="large" />

        <Text style={styles.loadingTitle}>
          Getting your location...
        </Text>

        <Text style={styles.loadingText}>
          Waiting for GPS coordinates
        </Text>
      </SafeAreaView>
    );
  }


  // ====================================================
  // USERS
  // ====================================================

  const users =
    Object.values(onlineUsers);


  // ====================================================
  // MAP
  // ====================================================

  return (
    <View style={styles.container}>

      <Mapbox.MapView
        style={StyleSheet.absoluteFill}
        styleURL={Mapbox.StyleURL.Street}
        onCameraChanged={
          handleCameraChanged
        }
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >

        {/* CAMERA STARTS FROM REAL GPS */}

        <Mapbox.Camera
          ref={cameraRef}
          centerCoordinate={[
            myLocation.coords.longitude,
            myLocation.coords.latitude,
          ]}
          zoomLevel={15}
          animationMode="none"
        />


        {/* MY LOCATION */}

        <Mapbox.PointAnnotation
          id="my-location"
          coordinate={[
            myLocation.coords.longitude,
            myLocation.coords.latitude,
          ]}
        >
          <View style={styles.myMarker}>
            <View
              style={styles.myMarkerInner}
            />
          </View>
        </Mapbox.PointAnnotation>


        {/* ONLINE USERS */}

        {users.map((user) => (
          <Mapbox.PointAnnotation
            key={user.user_id}
            id={`user-${user.user_id}`}
            coordinate={[
              user.longitude,
              user.latitude,
            ]}
            onSelected={() =>
              selectUser(user)
            }
          >
            <View
              style={[
                styles.userMarker,
                selectedUserId ===
                  user.user_id &&
                  styles.selectedMarker,
              ]}
            >
              <Text style={styles.markerText}>
                {user.displayName
                  ?.charAt(0)
                  ?.toUpperCase() || "U"}
              </Text>
            </View>
          </Mapbox.PointAnnotation>
        ))}

      </Mapbox.MapView>


      {/* ==================================================
          HEADER
      ================================================== */}

      <View
        style={[
          styles.header,
          {
            top: insets.top + 10,
          },
        ]}
      >

        <Pressable
          style={styles.headerButton}
          onPress={() =>
            setMenuOpen(
              (previous) => !previous
            )
          }
        >
          <Text style={styles.headerIcon}>
            ☰
          </Text>
        </Pressable>


        <View
          style={
            styles.headerTitleContainer
          }
        >
          <Text style={styles.headerTitle}>
            Live Location
          </Text>

          <View
            style={styles.connectionRow}
          >
            <View
              style={[
                styles.connectionDot,
                {
                  opacity:
                    socketConnected
                      ? 1
                      : 0.35,
                },
              ]}
            />

            <Text
              style={styles.connectionText}
            >
              {socketConnected
                ? `${users.length} online`
                : "Connecting..."}
            </Text>
          </View>
        </View>


        <View
          style={styles.profileButton}
        >
          <Text style={styles.profileText}>
            {currentUser?.displayName
              ?.charAt(0)
              ?.toUpperCase() ||
              currentUser?.email
                ?.charAt(0)
                ?.toUpperCase() ||
              "U"}
          </Text>
        </View>

      </View>


      {/* ==================================================
          SIDE MENU
      ================================================== */}

      {menuOpen && (
        <View
          style={[
            styles.sideMenu,
            {
              top:
                insets.top + 76,
              bottom:
                insets.bottom + 20,
            },
          ]}
        >

          <Text style={styles.menuTitle}>
            Online Users
          </Text>

          <Text style={styles.menuCount}>
            {users.length} user
            {users.length === 1
              ? ""
              : "s"} online
          </Text>


          {users.length === 0 ? (
            <View
              style={styles.emptyUsers}
            >
              <Text
                style={
                  styles.emptyUsersText
                }
              >
                No other users online
              </Text>
            </View>
          ) : (
            users.map((user) => (
              <Pressable
                key={user.user_id}
                style={[
                  styles.userRow,
                  selectedUserId ===
                    user.user_id &&
                    styles.selectedUserRow,
                ]}
                onPress={() =>
                  selectUser(user)
                }
              >

                <View
                  style={styles.userAvatar}
                >
                  <Text
                    style={
                      styles.userAvatarText
                    }
                  >
                    {user.displayName
                      ?.charAt(0)
                      ?.toUpperCase() ||
                      "U"}
                  </Text>
                </View>

                <View
                  style={styles.userInfo}
                >
                  <Text
                    style={styles.userName}
                    numberOfLines={1}
                  >
                    {user.displayName}
                  </Text>

                  <View
                    style={styles.onlineRow}
                  >
                    <View
                      style={styles.onlineDot}
                    />

                    <Text
                      style={styles.onlineText}
                    >
                      Online
                    </Text>
                  </View>
                </View>

                <Text
                  style={styles.arrowText}
                >
                  ›
                </Text>

              </Pressable>
            ))
          )}

        </View>
      )}


      {/* ==================================================
          MAP CONTROLS
      ================================================== */}

      <View
        style={[
          styles.mapControls,
          {
            bottom:
              insets.bottom + 110,
          },
        ]}
      >

        <Pressable
          style={styles.mapControl}
          onPress={zoomIn}
        >
          <Text style={styles.zoomText}>
            +
          </Text>
        </Pressable>


        <Pressable
          style={styles.mapControl}
          onPress={zoomOut}
        >
          <Text style={styles.zoomText}>
            −
          </Text>
        </Pressable>


        <Pressable
          style={styles.locationControl}
          onPress={goToMyLocation}
        >
          <Text style={styles.locationIcon}>
            ◎
          </Text>
        </Pressable>

      </View>


      {/* ==================================================
          SELECTED USER CARD
      ================================================== */}

      {selectedUserId &&
        onlineUsers[selectedUserId] && (
          <View
            style={[
              styles.selectedCard,
              {
                bottom:
                  insets.bottom + 18,
              },
            ]}
          >

            <View
              style={styles.selectedAvatar}
            >
              <Text
                style={
                  styles.selectedAvatarText
                }
              >
                {onlineUsers[
                  selectedUserId
                ].displayName
                  ?.charAt(0)
                  ?.toUpperCase() ||
                  "U"}
              </Text>
            </View>

            <View
              style={styles.selectedInfo}
            >
              <Text
                style={styles.selectedName}
                numberOfLines={1}
              >
                {
                  onlineUsers[
                    selectedUserId
                  ].displayName
                }
              </Text>

              <Text
                style={
                  styles.selectedCoordinates
                }
              >
                {onlineUsers[
                  selectedUserId
                ].latitude.toFixed(5)}
                {" , "}
                {onlineUsers[
                  selectedUserId
                ].longitude.toFixed(5)}
              </Text>
            </View>

            <Pressable
              style={
                styles.closeSelected
              }
              onPress={() =>
                setSelectedUserId(null)
              }
            >
              <Text
                style={
                  styles.closeSelectedText
                }
              >
                ×
              </Text>
            </Pressable>

          </View>
        )}

    </View>
  );
}


// ======================================================
// STYLES
// ======================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EAF2F8",
  },

  // ----------------------------------------------------
  // LOADING
  // ----------------------------------------------------

  centerScreen: {
    flex: 1,
    backgroundColor: "#F7F9FC",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  loadingTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },

  loadingText: {
    marginTop: 7,
    fontSize: 14,
    color: "#6B7280",
  },

  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },

  errorText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    textAlign: "center",
  },

  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#1677FF",
  },

  retryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  // ----------------------------------------------------
  // HEADER
  // ----------------------------------------------------

  header: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 58,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 8,

    backgroundColor:
      "rgba(255,255,255,0.96)",

    borderRadius: 18,

    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 6,
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 13,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "#F1F5F9",
  },

  headerIcon: {
    fontSize: 23,
    color: "#111827",
    fontWeight: "700",
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },

  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 10,
    backgroundColor: "#16A34A",
    marginRight: 5,
  },

  connectionText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "600",
  },

  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,

    backgroundColor: "#1677FF",

    justifyContent: "center",
    alignItems: "center",
  },

  profileText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  // ----------------------------------------------------
  // SIDE MENU
  // ----------------------------------------------------

  sideMenu: {
    position: "absolute",
    left: 16,
    width: 310,

    backgroundColor:
      "rgba(255,255,255,0.98)",

    borderRadius: 20,

    padding: 18,

    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 12,
  },

  menuTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },

  menuCount: {
    marginTop: 4,
    marginBottom: 14,

    fontSize: 12,
    color: "#6B7280",
  },

  emptyUsers: {
    paddingVertical: 30,
    alignItems: "center",
  },

  emptyUsersText: {
    color: "#9CA3AF",
    fontSize: 13,
  },

  userRow: {
    minHeight: 64,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 10,
    paddingVertical: 8,

    marginBottom: 7,

    borderRadius: 14,

    backgroundColor: "#F8FAFC",
  },

  selectedUserRow: {
    backgroundColor: "#E8F1FF",
  },

  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,

    backgroundColor: "#1677FF",

    alignItems: "center",
    justifyContent: "center",
  },

  userAvatarText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },

  userInfo: {
    flex: 1,
    marginLeft: 11,
  },

  userName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },

  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 10,
    backgroundColor: "#22C55E",
    marginRight: 5,
  },

  onlineText: {
    fontSize: 11,
    color: "#16A34A",
    fontWeight: "600",
  },

  arrowText: {
    fontSize: 25,
    color: "#94A3B8",
    marginLeft: 5,
  },

  // ----------------------------------------------------
  // MARKERS
  // ----------------------------------------------------

  myMarker: {
    width: 30,
    height: 30,

    borderRadius: 20,

    backgroundColor:
      "rgba(22,119,255,0.22)",

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,
    borderColor:
      "rgba(22,119,255,0.35)",
  },

  myMarkerInner: {
    width: 15,
    height: 15,

    borderRadius: 10,

    backgroundColor: "#1677FF",

    borderWidth: 3,
    borderColor: "#FFFFFF",
  },

  userMarker: {
    width: 42,
    height: 42,

    borderRadius: 23,

    backgroundColor: "#111827",

    borderWidth: 3,
    borderColor: "#FFFFFF",

    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 5,
  },

  selectedMarker: {
    backgroundColor: "#1677FF",

    transform: [
      {
        scale: 1.15,
      },
    ],
  },

  markerText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  // ----------------------------------------------------
  // MAP CONTROLS
  // ----------------------------------------------------

  mapControls: {
    position: "absolute",
    right: 16,

    alignItems: "center",

    gap: 8,
  },

  mapControl: {
    width: 48,
    height: 48,

    borderRadius: 15,

    backgroundColor:
      "rgba(255,255,255,0.97)",

    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 5,
  },

  zoomText: {
    fontSize: 27,
    lineHeight: 29,

    fontWeight: "500",
    color: "#111827",
  },

  locationControl: {
    width: 48,
    height: 48,

    marginTop: 4,

    borderRadius: 15,

    backgroundColor: "#1677FF",

    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 6,
  },

  locationIcon: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "600",
  },

  // ----------------------------------------------------
  // SELECTED USER
  // ----------------------------------------------------

  selectedCard: {
    position: "absolute",
    left: 16,
    right: 16,

    minHeight: 70,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 13,
    paddingVertical: 10,

    borderRadius: 18,

    backgroundColor:
      "rgba(255,255,255,0.98)",

    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 8,
  },

  selectedAvatar: {
    width: 45,
    height: 45,

    borderRadius: 23,

    backgroundColor: "#1677FF",

    alignItems: "center",
    justifyContent: "center",
  },

  selectedAvatarText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  selectedInfo: {
    flex: 1,
    marginLeft: 11,
  },

  selectedName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  selectedCoordinates: {
    marginTop: 4,
    fontSize: 11,
    color: "#6B7280",
  },

  closeSelected: {
    width: 36,
    height: 36,

    borderRadius: 18,

    backgroundColor: "#F1F5F9",

    alignItems: "center",
    justifyContent: "center",
  },

  closeSelectedText: {
    fontSize: 25,
    lineHeight: 27,
    color: "#475569",
  },
});
