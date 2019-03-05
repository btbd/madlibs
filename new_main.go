package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/google/uuid"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type WordRequest struct {
	Words []string `json:"words"`
	Nodes []string `json:"nodes"`
}

type WordResponse struct {
	Word     string `json:"word"`
	Request  string `json:"request"`
	Response string `json:"response"`
}

var events = make(map[string]map[string]interface{})

var timeout = 10
var password = "password"
var port = 80
var settings_dir = "."
var no_https_check = false

var binary = false
var verbose = 0

func Debug(level int, format string, args ...interface{}) {
	if verbose < level {
	return
	}

	if verbose > 1 {
	t := time.Now().Format("2006/01/02 15:04:05")
	format = t + ": " + format + "\n"
	}
	fmt.Fprintf(os.Stderr, format, args...)
}

func TimeNowMs() int64 {
	return time.Now().UnixNano() / int64(time.Millisecond)
}

func FormatRequest(r *http.Request) string {
	s, _ := httputil.DumpRequest(r, true)
	return string(s)
}

func HandleFileRequest(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	url := r.URL.Path[1:]
	if !strings.Contains(url, "admin") {
	bytes, err := ioutil.ReadFile(url)
	if err == nil {
	w.Write(bytes)
	return
	} else if strings.Trim(url, " \n\t\r") == "" {
	bytes, err := ioutil.ReadFile("index.html")
	if err == nil {
	w.Write(bytes)
	return
	}
	}
	}

	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte("404: \"" + url + "\" not found\n"))
}

func HandleWord(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	word_type := strings.ToLower(r.FormValue("w"))
	url, _ := url.QueryUnescape(r.FormValue("u"))
	id := uuid.New().String()
	etime := time.Now().Format("2006-01-02T15:04:05Z07:00")

	events[id] = nil
	word := "FAILURE"
	request := ""
	response := ""

	client := http.Client{}
	var req *http.Request

	if binary {
	req, _ = http.NewRequest("POST", url, nil)
	req.Header.Set("ce-specversion", "0.1")
	req.Header.Set("ce-type", "word.found."+word_type)
	req.Header.Set("ce-source", "https://srcdog.com/madlibs")
	req.Header.Set("ce-id", id)
	req.Header.Set("ce-time", etime)

	req.Header.Set("Content-Type", "application/json")
	} else {
	req, _ = http.NewRequest("POST", url, bytes.NewBuffer([]byte(strings.NewReplacer("\n", "", "\t", "", " ", "").Replace(`{
	"specversion":"0.1",
	"type":"word.found.`+word_type+`",
	"source":"https://srcdog.com/madlibs",
	"id":"`+id+`",
	"time":"`+etime+`"
	}`))))

	req.Header.Set("Content-Type", "application/cloudevents+json")
	}

	req.Header.Set("X-Callback-URL", "https://srcdog.com/madlibs/event")
	request = FormatRequest(req)

	resp, err := client.Do(req)

	if err == nil {
	body, err := ioutil.ReadAll(resp.Body)

	if body != nil {
	Debug(1, "Sync response body: %s", string(body))
	} else {
	Debug(1, "No sync response body")
	}

	if err == nil {
	if len(body) == 0 {
	end := TimeNowMs() + int64(timeout)*1000

	for events[id] == nil && TimeNowMs() < end {
	time.Sleep(100 * time.Millisecond)
	}

	if events[id] != nil {
	data := events[id]
	word = data["word"].(string)
	response = data["response"].(string)
	}
	} else {
	// Temporary until all services switch to async
	var data map[string]interface{}
	json.Unmarshal(body, &data)

	if binary {
	if data["word"] != nil {
	word = data["word"].(string)
	response = string(body)
	} else {
	Debug(1, "Missing 'word' property in response")
	}
	} else {
	if data["data"] != nil {
	word = data["data"].(map[string]interface{})["word"].(string)
	response = string(body)
	} else {
	Debug(1, "Missing 'data' property in response")
	}
	}
	}
	}

	if resp.Body != nil {
	resp.Body.Close()
	}
	} else {
	Debug(0, "%s", err)
	}

	msg, err := json.Marshal(WordResponse{
	Word:     word,
	Request:  request,
	Response: response,
	})

	delete(events, id)
	w.Write(msg)
}

func HandleEvent(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if r.Method == http.MethodPost {
	Debug(2, "In post")
	Debug(2, "headers: %#v", r.Header)
	if strings.Contains(strings.ToLower(r.Header.Get("Content-Type")), "application/cloudevents+json") {
	Debug(2, "structured")
	body, err := ioutil.ReadAll(r.Body)
	Debug(2, "body: %s", string(body))
	if err == nil {
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err == nil && data["relatedid"] != nil && data["data"] != nil {
	Debug(2, "data: %#v", data)
	id := data["relatedid"].(string)
	if _, ok := events[id]; ok {
	d := map[string]interface{}{}
	d["word"] = data["data"].(map[string]interface{})["word"].(string)
	d["response"] = FormatRequest(r)
	events[id] = d
	}
	}
	}
	} else {
	Debug(2, "binary")
	id := r.Header.Get("ce-relatedid")
	Debug(2, "id: %s", id)
	if _, ok := events[id]; ok {
	body, err := ioutil.ReadAll(r.Body)
	Debug(2, "body: %s", string(body))
	if err == nil {
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err == nil {
	d := map[string]interface{}{}
	d["word"] = data["word"].(string)
	d["response"] = FormatRequest(r)
	events[id] = d
	}
	}
	}
	}
	}
}

func HandleAdmin(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if v := r.Header.Get("Forwarded"); no_https_check || strings.Contains(strings.ToLower(v), ";proto=https") {
	if r.FormValue("p") == password {
	bytes, err := ioutil.ReadFile("admin.html")
	if err == nil {
	w.Write(bytes)
	} else {
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte("404: \"admin.html\" not found\n"))
	}
	} else {
	if r.FormValue("p") != "" {
	w.WriteHeader(http.StatusUnauthorized)
	}

	bytes, err := ioutil.ReadFile("admin_login.html")
	if err == nil {
	w.Write(bytes)
	} else {
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte("404: \"admin_login.html\" not found\n"))
	}
	}
	} else {
	w.WriteHeader(http.StatusNotFound)
	w.Write([]byte("404: \"" + r.URL.Path[1:] + "\" not found\n"))
	}
}

func HandleSettings(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()

	if v := r.Header.Get("Forwarded"); (no_https_check || strings.Contains(strings.ToLower(v), ";proto=https")) && r.Method == http.MethodPost && r.FormValue("p") == password {
	body, err := ioutil.ReadAll(r.Body)
	if err == nil {
	err = ioutil.WriteFile(settings_dir+"settings.json", body, 0644)
	if err == nil {
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err == nil {
	if data["binary"] != nil {
	binary = data["binary"].(bool)
	}
	}
	return
	}
	}

	w.WriteHeader(http.StatusInternalServerError)
	w.Write([]byte(err.Error()))
	fmt.Printf("Failed to update \""+settings_dir+"settings.json\" file:\n\t%v\n", err)
	} else {
	bytes, err := ioutil.ReadFile(settings_dir + "settings.json")
	if err == nil {
	w.Write(bytes)
	} else {
	err := ioutil.WriteFile(settings_dir+"settings.json", []byte(""), 0644)
	if err != nil {
	w.WriteHeader(http.StatusInternalServerError)
	w.Write([]byte(err.Error()))
	fmt.Printf("Failed to find or create \"settings.json\":\n\t%v\n", err)
	}
	}
	}
}

func main() {
	usage := flag.Usage
	flag.Usage = func() {
	fmt.Println("CloudEvents Demo")
	usage()
	}

	flag.BoolVar(&no_https_check, "no-https", no_https_check, "disable https check for admin settings")
	flag.IntVar(&port, "p", port, "port")
	flag.StringVar(&password, "password", password, "password for \"."+string(os.PathSeparator)+"admin\" page")
	flag.StringVar(&settings_dir, "d", settings_dir, "directory for \"settings.json\"")
	flag.IntVar(&timeout, "t", timeout, "timeout (seconds) before an async request is ignored")
	flag.IntVar(&verbose, "v", verbose, "verbose/debugging level")

	flag.Parse()

	if len(strings.Trim(settings_dir, " \r\n\t")) == 0 {
	settings_dir = "." + string(os.PathSeparator)
	} else if settings_dir[len(settings_dir)-1] != os.PathSeparator {
	settings_dir += string(os.PathSeparator)
	}

	bytes, err := ioutil.ReadFile(settings_dir + "settings.json")
	if err == nil {
	var data map[string]interface{}
	if err := json.Unmarshal(bytes, &data); err == nil {
	if data["binary"] != nil {
	binary = data["binary"].(bool)
	}
	}
	} else {
	err := ioutil.WriteFile(settings_dir+"settings.json", []byte(""), 0644)
	if err != nil {
	fmt.Printf("Failed to find or create \"settings.json\":\n\t%v\n", err)
	os.Exit(1)
	}
	}

	http.HandleFunc("/", HandleFileRequest)
	http.HandleFunc("/word", HandleWord)
	http.HandleFunc("/admin", HandleAdmin)
	http.HandleFunc("/settings", HandleSettings)
	http.HandleFunc("/event", HandleEvent)

	fmt.Printf("Listening on port %d\n", port)

	if err := http.ListenAndServe(":"+strconv.Itoa(port), nil); err != nil {
	fmt.Fprintf(os.Stderr, "Error starting HTTP server:\n\t%v\n", err)
	os.Exit(1)
	}
}