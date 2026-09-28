document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. INDEXEDDB CONTROLLER
    // ==========================================
    const DB_NAME = "HomeTubeDB";
    const DB_VERSION = 1;

    const openDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("videos")) {
                    db.createObjectStore("videos", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("favorites")) {
                    db.createObjectStore("favorites", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("history")) {
                    db.createObjectStore("history", { keyPath: "id" });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };

    const dbStore = {
        async getAll(storeName) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        },
        async put(storeName, item) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                const req = store.put(item);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        },
        async delete(storeName, id) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                const req = store.delete(id);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        },
        async clear(storeName) {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, "readwrite");
                const store = tx.objectStore(storeName);
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    };

    // ==========================================
    // 2. USER SESSION MANAGEMENT
    // ==========================================
    const getCurrentUser = () => JSON.parse(localStorage.getItem("hometube_user")) || { username: "Guest" };
    const setCurrentUser = (user) => localStorage.setItem("hometube_user", JSON.stringify(user));

    const user = getCurrentUser();
    if (user && user.username) {
        const initial = user.username.charAt(0).toUpperCase();
        const mainAvatar = document.getElementById("mainAvatarLetter");
        const profileName = document.getElementById("displayProfileName");
        const profileHandle = document.getElementById("displayProfileHandle");

        if (mainAvatar) mainAvatar.textContent = initial;
        if (profileName) profileName.textContent = user.username;
        if (profileHandle) profileHandle.textContent = `@${user.username.toLowerCase().replace(/\s+/g, '')}`;
    }

    const addAccountForm = document.getElementById("addAccountForm");
    if (addAccountForm) {
        addAccountForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById("usernameInput");
            const username = usernameInput ? usernameInput.value.trim() : "";
            if (username) {
                setCurrentUser({ username, loggedIn: true });
                window.location.href = "Account.html";
            }
        });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("hometube_user");
            window.location.href = "AddAccount.html";
        });
    }

    // ==========================================
    // 3. UPLOAD PAGE & PREVIEW BOX LOGIC
    // ==========================================
    const dropZone = document.getElementById("dropZone");
    const fileInput = document.getElementById("videoFileInput");
    const previewPlayer = document.getElementById("previewPlayer");
    const previewPlaceholder = document.getElementById("previewPlaceholder");
    const fileMeta = document.getElementById("fileMeta");
    const uploadForm = document.getElementById("uploadForm");

    let selectedFile = null;

    if (dropZone && fileInput) {
        dropZone.addEventListener("click", () => fileInput.click());

        const handleFileSelection = (file) => {
            if (file) {
                selectedFile = file;
                const videoURL = URL.createObjectURL(file);
                previewPlayer.src = videoURL;
                previewPlayer.style.display = "block";
                if (previewPlaceholder) previewPlaceholder.style.display = "none";

                if (fileMeta) {
                    fileMeta.innerHTML = `<strong>File:</strong> ${file.name}<br><strong>Size:</strong> ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
                }
            }
        };

        fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
        });

        ["dragenter", "dragover"].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add("dragover");
            }, false);
        });

        ["dragleave", "drop"].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove("dragover");
            }, false);
        });

        dropZone.addEventListener("drop", (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0 && files[0].type.startsWith("video/")) {
                fileInput.files = files;
                handleFileSelection(files[0]);
            } else {
                alert("Please drop a valid video file.");
            }
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener("submit", async(e) => {
            e.preventDefault();

            const title = document.getElementById("videoTitle").value.trim();
            const channel = document.getElementById("videoChannel").value.trim();
            const statusMsg = document.getElementById("uploadStatus");
            const submitBtn = document.getElementById("submitBtn");

            const file = selectedFile || (fileInput && fileInput.files[0]);
            if (!file) {
                statusMsg.style.color = "#ff4444";
                statusMsg.textContent = "Please select or drop a video file.";
                return;
            }

            submitBtn.disabled = true;
            statusMsg.style.color = "#ffaa00";
            statusMsg.textContent = "Saving video binary blob to database...";

            try {
                const newVideo = {
                    id: "v_" + Date.now(),
                    title: title,
                    channel: channel,
                    blob: file,
                    timestamp: Date.now()
                };

                await dbStore.put("videos", newVideo);

                statusMsg.style.color = "#00ff66";
                statusMsg.textContent = "Upload successful! Redirecting...";

                setTimeout(() => {
                    window.location.href = "index.html";
                }, 800);
            } catch (err) {
                console.error("Database error:", err);
                statusMsg.style.color = "#ff4444";
                statusMsg.textContent = "Failed to save video to database.";
                submitBtn.disabled = false;
            }
        });
    }

    // ==========================================
    // 4. RENDERING ENGINE & FEED ACTIONS
    // ==========================================
    const renderVideoCard = (video, isFav) => {
        const videoSrc = video.blob ? URL.createObjectURL(video.blob) : video.src;

        return `
            <div class="video-card" data-id="${video.id}">
                <video controls preload="metadata" src="${videoSrc}">
                    Your browser does not support HTML5 video.
                </video>
                <div class="video-info">
                    <div class="video-title">${video.title}</div>
                    <div class="video-channel">${video.channel}</div>
                    <div class="video-actions">
                        <button class="action-btn fav-btn ${isFav ? 'active' : ''}">
                            ${isFav ? '♥ Liked' : '♡ Like'}
                        </button>
                        <button class="action-btn btn-delete delete-btn">Delete</button>
                    </div>
                </div>
            </div>
        `;
    };

    const bindGridEvents = (container, renderFunc) => {
        if (!container) return;

        container.addEventListener("click", async(e) => {
            const card = e.target.closest(".video-card");
            if (!card) return;

            const videoId = card.getAttribute("data-id");
            const videos = await dbStore.getAll("videos");
            const video = videos.find(v => v.id === videoId);

            if (!video) return;

            // Track watch history on video click/play
            if (e.target.tagName === "VIDEO") {
                const history = await dbStore.getAll("history");
                if (!history.some(h => h.id === video.id)) {
                    await dbStore.put("history", video);
                }
            }

            // Toggle Likes/Favorites
            if (e.target.classList.contains("fav-btn")) {
                const favs = await dbStore.getAll("favorites");
                const isFav = favs.some(f => f.id === video.id);

                if (isFav) {
                    await dbStore.delete("favorites", video.id);
                } else {
                    await dbStore.put("favorites", video);
                }
                renderFunc();
            }

            // Delete video globally across all stores
            if (e.target.classList.contains("delete-btn")) {
                await dbStore.delete("videos", videoId);
                await dbStore.delete("favorites", videoId);
                await dbStore.delete("history", videoId);
                renderFunc();
            }
        });
    };

    // --- Home Page Feed ---
    const videoFeed = document.getElementById("video-feed");
    const renderFeed = async() => {
        if (!videoFeed) return;
        const videos = await dbStore.getAll("videos");
        const favorites = await dbStore.getAll("favorites");

        if (videos.length === 0) {
            videoFeed.innerHTML = `
                <div class="empty-state">
                    <p>No videos available yet.</p>
                    <a href="upload.html" class="btn btn-primary" style="margin-top: 1rem;">+ Upload Video</a>
                </div>
            `;
            return;
        }

        videoFeed.innerHTML = videos.map(v => {
            const isFav = favorites.some(f => f.id === v.id);
            return renderVideoCard(v, isFav);
        }).join('');
    };

    if (videoFeed) {
        renderFeed();
        bindGridEvents(videoFeed, renderFeed);
    }

    // --- Favorites Page ---
    const favoritesGrid = document.getElementById("favorites-grid");
    const renderFavorites = async() => {
        if (!favoritesGrid) return;
        const favorites = await dbStore.getAll("favorites");

        if (favorites.length === 0) {
            favoritesGrid.innerHTML = `<div class="empty-state"><p>No liked videos yet.</p></div>`;
            return;
        }

        favoritesGrid.innerHTML = favorites.map(v => renderVideoCard(v, true)).join('');
    };

    if (favoritesGrid) {
        renderFavorites();
        bindGridEvents(favoritesGrid, renderFavorites);
    }

    // --- History Page ---
    const historyGrid = document.getElementById("history-grid");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    const renderHistory = async() => {
        if (!historyGrid) return;
        const history = await dbStore.getAll("history");
        const favorites = await dbStore.getAll("favorites");

        if (history.length === 0) {
            historyGrid.innerHTML = `<div class="empty-state"><p>Watch history is empty.</p></div>`;
            return;
        }

        historyGrid.innerHTML = history.map(v => {
            const isFav = favorites.some(f => f.id === v.id);
            return renderVideoCard(v, isFav);
        }).join('');
    };

    if (historyGrid) {
        renderHistory();
        bindGridEvents(historyGrid, renderHistory);
    }

    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener("click", async() => {
            await dbStore.clear("history");
            renderHistory();
        });
    }
});